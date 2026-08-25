import { createServer } from 'node:http'
const first = createServer().listen(39876)
first.once('listening', () => createServer().listen(39876))
