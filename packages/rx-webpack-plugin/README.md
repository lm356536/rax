# rx-webpack-plugin [![npm](https://img.shields.io/npm/v/rx-webpack-plugin.svg)](https://www.npmjs.com/package/rx-webpack-plugin) [![Dependency Status](https://david-dm.org/alibaba/rx.svg?path=packages/rx-webpack-plugin)](https://david-dm.org/alibaba/rx.svg?path=packages/rx-webpack-plugin) [![Known Vulnerabilities](https://snyk.io/test/npm/rx-webpack-plugin/badge.svg)](https://snyk.io/test/npm/rx-webpack-plugin)

> Webpack plugin for Rx framework.

## Install

```sh
$ npm install --save-dev rx-webpack-plugin
```

## Usage

``` javascript
var RxWebpackPlugin = require('rx-webpack-plugin');

module.exports = {
  plugins: [
    new RxWebpackPlugin({
      runMainModule: false,
      requireBuiltinModule: true,
      includePolyfills: false,  
      moduleName: 'rx',
      globalName: 'Rx',
    })
  ]
}
```