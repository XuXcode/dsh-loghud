import { describe, expect, it } from 'vitest'
import { ErrorStore } from '../src/core/store.js'
import { LogProcessor } from '../src/core/processor.js'

interface PythonCase {
  name: string
  log: string
  exception: string
  category?: 'PYTHON_RUNTIME' | 'PYTHON_IMPORT' | 'PYTHON_TEST_FAILURE'
  command?: string
}

const traceback = (exception: string, message: string, file = '/workspace/app/main.py', line = 12, symbol = 'run') => `Traceback (most recent call last):\n  File "${file}", line ${line}, in ${symbol}\n    execute()\n${exception}: ${message}`

const cases: PythonCase[] = [
  { name: 'TypeError on Unix', log: traceback('TypeError', "'NoneType' object is not subscriptable"), exception: 'TypeError' },
  { name: 'ValueError on Windows', log: traceback('ValueError', "invalid literal for int()", 'C:\\work\\app\\main.py', 8, 'parse'), exception: 'ValueError' },
  { name: 'NameError', log: traceback('NameError', "name 'user' is not defined"), exception: 'NameError' },
  { name: 'AttributeError', log: traceback('AttributeError', "'NoneType' object has no attribute 'id'"), exception: 'AttributeError' },
  { name: 'ImportError', log: traceback('ImportError', "cannot import name 'Client' from 'sdk'"), exception: 'ImportError', category: 'PYTHON_IMPORT' },
  { name: 'ModuleNotFoundError', log: traceback('ModuleNotFoundError', "No module named 'missing_sdk'"), exception: 'ModuleNotFoundError', category: 'PYTHON_IMPORT' },
  { name: 'KeyError', log: traceback('KeyError', "'token'"), exception: 'KeyError' },
  { name: 'IndexError', log: traceback('IndexError', 'list index out of range'), exception: 'IndexError' },
  { name: 'ZeroDivisionError', log: traceback('ZeroDivisionError', 'division by zero'), exception: 'ZeroDivisionError' },
  { name: 'FileNotFoundError', log: traceback('FileNotFoundError', "[Errno 2] No such file or directory: 'config.json'"), exception: 'FileNotFoundError' },
  { name: 'PermissionError', log: traceback('PermissionError', "[Errno 13] Permission denied: '/data'"), exception: 'PermissionError' },
  { name: 'ConnectionError', log: traceback('ConnectionError', 'Connection refused'), exception: 'ConnectionError' },
  { name: 'TimeoutError', log: traceback('TimeoutError', 'operation timed out'), exception: 'TimeoutError' },
  { name: 'SyntaxError with column', log: '  File "/workspace/app/broken.py", line 3\n    value =\n           ^\nSyntaxError: invalid syntax', exception: 'SyntaxError' },
  { name: 'asyncio task failure', log: `Task exception was never retrieved\nfuture: <Task finished name='Task-2'>\n${traceback('RuntimeError', 'background task failed', '/workspace/app/worker.py', 21, 'worker')}`, exception: 'RuntimeError' },
  { name: 'explicit cause chain', log: `${traceback('ValueError', 'bad source')}\n\nThe above exception was the direct cause of the following exception:\n\n${traceback('RuntimeError', 'conversion failed', '/workspace/app/service.py', 30, 'convert')}`, exception: 'RuntimeError' },
  { name: 'implicit handling chain', log: `${traceback('KeyError', "'id'")}\n\nDuring handling of the above exception, another exception occurred:\n\n${traceback('LookupError', 'user missing', '/workspace/app/service.py', 31, 'lookup')}`, exception: 'LookupError' },
  { name: 'pytest assertion', log: 'FAILED tests/test_user.py::test_name - AssertionError: wrong name\nE   AssertionError: wrong name', exception: 'AssertionError', category: 'PYTHON_TEST_FAILURE', command: 'pytest -q' },
  { name: 'pytest compact frame', log: 'tests/test_math.py:14: AssertionError\nE   AssertionError: expected 4', exception: 'AssertionError', category: 'PYTHON_TEST_FAILURE', command: 'python -m pytest' },
  { name: 'Python 3.14 detailed TypeError', log: traceback('TypeError', 'unsupported operand type(s) for +: int and str'), exception: 'TypeError', command: 'python3.14 app.py' },
  { name: 'uv command family', log: traceback('RuntimeError', 'uv application failed'), exception: 'RuntimeError', command: 'uv run python app.py' },
  { name: 'poetry command family', log: traceback('RuntimeError', 'poetry application failed'), exception: 'RuntimeError', command: 'poetry run python app.py' },
]

function detect(input: PythonCase) {
  const store = new ErrorStore()
  new LogProcessor(store).finish('python-session', input.log, { command: input.command ?? 'python app.py', captureMode: 'tool-result', exitCode: 1 })
  const snapshot = store.snapshot('python-session')
  expect(snapshot.active, input.name).toHaveLength(1)
  return snapshot.active[0]!
}

describe('Python parser', () => {
  for (const input of cases) it(input.name, () => {
    const event = detect(input)
    expect(event.language).toBe('python')
    expect(event.runtime).toBe('python')
    expect(event.parserId).toBe('python')
    expect(event.exceptionType).toBe(input.exception)
    expect(event.category).toBe(input.category ?? 'PYTHON_RUNTIME')
  })

  it('extracts a business frame before virtual-environment frames', () => {
    const event = detect({ name: 'business frame', exception: 'ValueError', log: 'Traceback (most recent call last):\n  File "/workspace/.venv/lib/python3.12/site-packages/framework.py", line 5, in invoke\n    callback()\n  File "/workspace/app/service.py", line 42, in load_user\n    parse()\nValueError: invalid user' })
    expect(event.file).toBe('/workspace/app/service.py')
    expect(event.line).toBe(42)
    expect(event.symbol).toBe('load_user')
  })

  it('preserves line and syntax-error column data', () => {
    const event = detect(cases.find((input) => input.name === 'SyntaxError with column')!)
    expect(event.file).toBe('/workspace/app/broken.py')
    expect(event.line).toBe(3)
    expect(event.column).toBeGreaterThan(1)
  })

  it('extracts a missing module target', () => {
    expect(detect(cases.find((input) => input.name === 'ModuleNotFoundError')!).target).toBe('missing_sdk')
  })

  it('uses Python parser metadata when a shell result omits the command', () => {
    const store = new ErrorStore(); new LogProcessor(store).finish('no-command', traceback('TypeError', 'missing command metadata'), { captureMode: 'tool-result', exitCode: 1 })
    expect(store.snapshot('no-command').active[0]).toMatchObject({ language: 'python', runtime: 'python', parserId: 'python' })
  })

  it('handles arbitrary chunk boundaries without duplicate cards', () => {
    const store = new ErrorStore(); const processor = new LogProcessor(store); const log = traceback('TypeError', 'chunked failure')
    for (const character of log) processor.push('chunks', character, { command: 'python app.py', captureMode: 'streaming-tool' })
    processor.finish('chunks', '', { command: 'python app.py', captureMode: 'streaming-tool', exitCode: 1 })
    expect(store.snapshot('chunks').active).toHaveLength(1)
  })

  it('deduplicates one Python failure repeated 1000 times', () => {
    const store = new ErrorStore(); const processor = new LogProcessor(store); const log = traceback('ValueError', 'same failure')
    for (let index = 0; index < 1000; index++) processor.finish('repeat', log, { command: 'python app.py', captureMode: 'tool-result', exitCode: 1 })
    const snapshot = store.snapshot('repeat')
    expect(snapshot.active).toHaveLength(1)
    expect(snapshot.active[0]?.occurrences).toBe(1000)
  })
})
