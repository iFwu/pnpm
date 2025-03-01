import prepare from '@pnpm/prepare'
import {
  execPnpm,
  retryLoadJsonFile,
  spawnPnpm,
} from '../utils'
import isWindows = require('is-windows')
import path = require('path')
import pathExists = require('path-exists')

const skipOnWindows = isWindows() ? test.skip : test

skipOnWindows('self-update stops the store server', async () => {
  prepare()

  spawnPnpm(['server', 'start'])

  const serverJsonPath = path.resolve('../store/v3/server/server.json')
  const serverJson = await retryLoadJsonFile<{ connectionOptions: object }>(serverJsonPath)
  expect(serverJson).toBeTruthy()
  expect(serverJson.connectionOptions).toBeTruthy()

  const global = path.resolve('global')

  const env = { NPM_CONFIG_PREFIX: global }
  if (process.env.APPDATA) env['APPDATA'] = global

  await execPnpm(['install', '-g', 'pnpm', '--store-dir', path.resolve('..', 'store')], { env })

  expect(await pathExists(serverJsonPath)).toBeFalsy()
})
