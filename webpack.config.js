const webpack = require('webpack')
const path = require('path')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const PeerDepsExternalsPlugin = require('peer-deps-externals-webpack-plugin')

function configure(env) {

  let config = {
    target: 'web',
    entry: [
      './src/index'
    ],
    output: {
      path: path.resolve('./lib/'),
      filename: 'index.js',
      library: 'redux-jam',
      libraryTarget: 'umd'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /(node_modules)/,
          use: {
            loader: 'babel-loader'
          }
        }
      ]
    },
    resolve: {
      modules: [
        path.resolve(__dirname, 'src'),
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

  if (env && env.production) {
    config.plugins = config.plugins.concat([
      new webpack.HashedModuleIdsPlugin(),
      new CleanWebpackPlugin([config.output.path], {root: path.resolve('..')})
    ])
    config.optimization = {
      minimizer: [
        new UglifyJsPlugin({
          uglifyOptions: {
            compress: {
              pure_funcs: [
                'console.log',
                'console.debug'
              ]
            }
          }
        })
      ]
    }
  }

  return config
}

module.exports = configure


/* let webpack = require('webpack')
 * let path = require('path')
 * let PeerDepsExternalsPlugin = require('peer-deps-externals-webpack-plugin')
 * 
 * module.exports = {
 *   entry: [
 *     './src/index'
 *   ],
 *   output: {
 *     filename: 'index.js',
 *     path: path.resolve('./lib/'),
 *     libraryTarget: 'umd'
 *   },
 *   module: {
 *     rules: [
 *       {
 *         test: /\.(js|jsx)$/,
 *         exclude: /(node_modules)/,
 *         use: [
 *           'babel-loader'
 *         ]
 *       },
 *       {
 *         test: /\.(woff2?|eot|ttf|svg|otf)(\?.+)?$/i,
 *         use: [
 *           'url-loader?limit=10000&name=[name].[ext]'
 *         ]
 *       }
 *     ]
 *   },
 *   resolve: {
 *     modules: [
 *       path.resolve(__dirname, './src'),
 *       'node_modules'
 *     ],
 *     extensions: [
 *       '.js', '.jsx'
 *     ]
 *   },
 *   plugins: [
 *     new PeerDepsExternalsPlugin()
 *   ]
 * } */
