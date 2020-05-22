import fs from 'fs-extra'
import { join } from 'path'
import { IConfig } from './start'

async function prepare(rootDir: string) {
  // 内置插件
  const builtInPlugins: IConfig['plugins'] = [
    {
      name: 'add-user',
      options: {} as any
    }
  ]

  // 写入默认配置文件
  const configFile = join(rootDir, '../config.json')
  await fs.writeJSON(configFile, {
    plugins: builtInPlugins
  } as Partial<IConfig>)

  // 依赖修复
  const pkgFile = join(rootDir, './package.json')
  const pkgContent: Record<
    'dependencies' | 'devDependencies',
    Record<string, string>
  > = await fs.readJson(pkgFile)
  Object.assign(pkgContent.dependencies, pkgContent.devDependencies)
  delete pkgContent.devDependencies
  const deps = pkgContent.dependencies
  for (const name of Object.keys(deps)) {
    if (
      [
        'sass-loader',
        'node-sass',
        'ghooks',
        'ava',
        'rewire',
        'react-scripts',
        'nodemon',
        'validate-commit-msg',
        'webpack-dev-middleware'
      ].includes(name) ||
      name.includes('eslint') ||
      name.includes('redux-devtools') ||
      name.includes('ydoc')
    ) {
      delete deps[name]
    }
  }
  Object.assign(deps, {
    // start.js 运行需要
    'deepmerge': '4.2.2',
    // sass 处理需要，用 dart-sass 替代了 node-sass
    'sass-loader': '7.3.1',
    'sass': '1.22.10',
    // react-scripts 的替代
    'url-loader': '0.5.9',
    'babel-preset-env': '1.6.1',
    // 内置插件
    ...builtInPlugins.reduce<Record<string, string>>((res, plugin) => {
      res[`yapi-plugin-${plugin.name}`] = 'latest'
      return res
    }, {})
  })
  pkgContent.dependencies = deps
  await fs.writeJSON(pkgFile, pkgContent)

  // 支持 adminPassword 配置项
  const installFile = join(rootDir, './server/install.js')
  let installFileContent = await fs.readFile(installFile, 'utf8')
  installFileContent = installFileContent
    .replace(
      'yapi.commons.generatePassword(',
      'yapi.commons.generatePassword(yapi.WEBCONFIG.adminPassword || '
    )
    .replace(
      '密码："ymfe.org"',
      '密码："${yapi.WEBCONFIG.adminPassword || "ymfe.org"}"'
    )
  await fs.writeFile(installFile, installFileContent)

  // 去除 eslint
  const ykitConfigFile = join(rootDir, './ykit.config.js')
  let ykitConfigContent = await fs.readFile(ykitConfigFile, 'utf8')
  ykitConfigContent = ykitConfigContent.replace(
    /baseConfig\.module\.preLoaders\.push.*?eslint-loader.*?;/s,
    ''
  )
  await fs.writeFile(ykitConfigFile, ykitConfigContent)
}

prepare(process.argv[2])
