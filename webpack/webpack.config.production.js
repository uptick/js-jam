var webpack = require( 'webpack' );
var ExtractTextPlugin = require( 'extract-text-webpack-plugin' );
var NodeExternals = require( 'webpack-node-externals' );
var config = require( './webpack.config.base' );

config.output.filename = 'index.js';

config.entry = ['./src/index'];

// Extract CSS modules.
config.module.loaders[1] = {
    test: /.css$/,
    loader: ExtractTextPlugin.extract( 'style', 'css?modules&importLoaders=1&localIdentName=[name]__[local]___[hash:base64:5]' )
};

config.plugins = [

    // Extract CSS modules.
    new ExtractTextPlugin( 'redux-jam.min.css', {
        allChunks: true
    }),

    // removes a lot of debugging code in React
    new webpack.DefinePlugin({
        'process.env': {
            'NODE_ENV': JSON.stringify( 'production' )
        }
    }),

    // keeps hashes consistent between compilations
    new webpack.optimize.OccurenceOrderPlugin(),

    // identify common code
    new webpack.optimize.DedupePlugin()

    // minifies your code
    /*
    new webpack.optimize.UglifyJsPlugin({
        compressor: {
            warnings: false
        }
    })
    */
]

// Remove duplicated libraries when publishing.
config.externals = [
    NodeExternals()
];

module.exports = config;
