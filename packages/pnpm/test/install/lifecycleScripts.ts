import prepare from '@pnpm/prepare'
import { PackageManifest } from '@pnpm/types'
import { execPnpmSync } from '../utils'
import path = require('path')
import PATH = require('path-name')
import loadJsonFile = require('load-json-file')

const pkgRoot = path.join(__dirname, '..', '..')
const pnpmPkg = loadJsonFile.sync<PackageManifest>(path.join(pkgRoot, 'package.json'))

test('installation fails if lifecycle script fails', () => {
  prepare({
    scripts: {
      preinstall: 'exit 1',
    },
  })

  const result = execPnpmSync(['install'])

  expect(result.status).toBe(1)
})

test('lifecycle script runs with the correct user agent', () => {
  prepare({
    scripts: {
      preinstall: 'node --eval "console.log(process.env.npm_config_user_agent)"',
    },
  })

  const result = execPnpmSync(['install'])

  expect(result.status).toBe(0)
  const expectedUserAgentPrefix = `${pnpmPkg.name}/${pnpmPkg.version} `
  expect(result.stdout.toString().includes(expectedUserAgentPrefix)).toBeTruthy()
})

test('preinstall is executed before general installation', () => {
  prepare({
    scripts: {
      preinstall: 'echo "Hello world!"',
    },
  })

  const result = execPnpmSync(['install'])

  expect(result.status).toBe(0)
  expect(result.stdout.toString().includes('Hello world!')).toBeTruthy()
})

test('postinstall is executed after general installation', () => {
  prepare({
    scripts: {
      postinstall: 'echo "Hello world!"',
    },
  })

  const result = execPnpmSync(['install'])

  expect(result.status).toBe(0)
  expect(result.stdout.toString().includes('Hello world!')).toBeTruthy()
})

test('postinstall is not executed after named installation', () => {
  prepare({
    scripts: {
      postinstall: 'echo "Hello world!"',
    },
  })

  const result = execPnpmSync(['install', 'is-negative'])

  expect(result.status).toBe(0)
  expect(!result.stdout.toString().includes('Hello world!')).toBeTruthy()
})

test('prepare is not executed after installation with arguments', () => {
  prepare({
    scripts: {
      prepare: 'echo "Hello world!"',
    },
  })

  const result = execPnpmSync(['install', 'is-negative'])

  expect(result.status).toBe(0)
  expect(!result.stdout.toString().includes('Hello world!')).toBeTruthy()
})

test('prepare is executed after argumentless installation', () => {
  prepare({
    scripts: {
      prepare: 'echo "Hello world!"',
    },
  })

  const result = execPnpmSync(['install'])

  expect(result.status).toBe(0)
  expect(result.stdout.toString().includes('Hello world!')).toBeTruthy()
})

test('lifecycle events have proper npm_config_argv', async () => {
  prepare({
    dependencies: {
      'write-lifecycle-env': '^1.0.0',
    },
    scripts: {
      postinstall: 'write-lifecycle-env',
    },
  })

  execPnpmSync(['install'])

  const lifecycleEnv = await loadJsonFile<object>('env.json')

  expect(JSON.parse(lifecycleEnv['npm_config_argv'])).toStrictEqual({
    cooked: ['install'],
    original: ['install'],
    remain: ['install'],
  })
})

test('dependency should not be added to package.json and lockfile if it was not built successfully', async () => {
  const project = prepare({ name: 'foo', version: '1.0.0' })

  const result = execPnpmSync(['install', 'package-that-cannot-be-installed@0.0.0'])

  expect(result.status).toBe(1)

  expect(await project.readCurrentLockfile()).toBeFalsy()
  expect(await project.readLockfile()).toBeFalsy()

  const { default: pkg } = await import(path.resolve('package.json'))
  expect(pkg).toStrictEqual({ name: 'foo', version: '1.0.0' })
})

test('node-gyp is in the PATH', async () => {
  prepare({
    scripts: {
      test: 'node-gyp --help',
    },
  })

  // `npm test` adds node-gyp to the PATH
  // it is removed here to test that pnpm adds it
  const initialPath = process.env.PATH

  if (typeof initialPath !== 'string') throw new Error('PATH is not defined')

  process.env[PATH] = initialPath
    .split(path.delimiter)
    .filter((p: string) => !p.includes('node-gyp-bin') && !p.includes('npm'))
    .join(path.delimiter)

  const result = execPnpmSync(['test'])

  process.env[PATH] = initialPath

  expect(result.status).toBe(0)
})
