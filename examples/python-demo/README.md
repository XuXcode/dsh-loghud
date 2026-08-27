# Python demo

These dependency-free scripts reproduce three Python failures for LogHUD without making network requests or installing packages.

```sh
python examples/python-demo/type_error.py
python examples/python-demo/module_missing.py
python examples/python-demo/connection_error.py
```

Each command exits with a non-zero status and prints a standard Python traceback. Run it through an ordinary Harness shell to test final-result capture, or through `loghud_run` to test incremental capture.
