let webpack = require('webpack')
let path = require('path')
let PeerDepsExternalsPlugin = require('peer-deps-externals-webpack-plugin')

module.exports = {
  entry: [
    './src/index'
  ],
  output: {
    filename: 'index.js',
    path: path.resolve('./lib/'),
    libraryTarget: 'umd'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /(node_modules)/,
        use: [
          'babel-loader'
        ]
      },
      {
        test: /\.(woff2?|eot|ttf|svg|otf)(\?.+)?$/i,
        use: [
          'url-loader?limit=10000&name=[name].[ext]'
        ]
      }
    ]
  },
  resolve: {
    modules: [
      path.resolve(__dirname, './src'),
      'node_modules'
    ],
    extensions: [
      '.js', '.jsx'
    ]
  },
  plugins: [
    new PeerDepsExternalsPlugin()
  ]
}
