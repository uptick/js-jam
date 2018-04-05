let path = require('path')
let webpack = require('webpack')

module.exports = {
  context: path.resolve(path.join(__dirname, '..')),
  entry: [
    './src/index'
  ],
  output: {
    path: path.resolve('./lib/'),
    libraryTarget: 'umd',
    filename: 'index.js'
  },
  plugins: [
//    new webpack.optimize.ModuleConcatenationPlugin()
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          'babel-loader'
        ]
      },
      {
        test: /(node_modules|static|resources)\/.*\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: false,
              importLoaders: 1
            }
          }
        ]
      },
      {
        test: /\.(png|gif|jpe?g)$/i,
        use: [
          'file-loader?hash=sha512&digest=hex&name=[name]-[hash].[ext]'
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
      path.resolve(__dirname, '../src'),
      'node_modules'
    ],
    extensions: ['.js', '.jsx']
  },
  devtool: 'cheap-module-eval-source-map'
};
