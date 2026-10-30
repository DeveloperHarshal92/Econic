const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js',
    publicPath: '/',
    clean: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          isProd ? MiniCssExtractPlugin.loader : 'style-loader',
          'css-loader',
        ],
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
        catalog: `catalog@${process.env.CATALOG_URL || '/remote/catalog'}/remoteEntry.js`,
        cart: `cart@${process.env.CART_URL || '/remote/cart'}/remoteEntry.js`,
        checkout: `checkout@${process.env.CHECKOUT_URL || '/remote/checkout'}/remoteEntry.js`,
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.2.0', eager: true },
        'react-dom': { singleton: true, requiredVersion: '^18.2.0', eager: true },
        'react-router-dom': { singleton: true, requiredVersion: '^6.22.0', eager: true },
      },
    }),
    new HtmlWebpackPlugin({
      template: './src/index.html',
      title: 'VÊTU — Premium E-Commerce',
      publicPath: '/',
      favicon: false,
    }),
    ...(isProd ? [new MiniCssExtractPlugin({ filename: '[name].[contenthash:8].css' })] : []),
  ],
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    proxy: [
      {
        context: ['/api'],
        target: process.env.API_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
      {
        context: ['/remote/catalog'],
        target: process.env.CATALOG_DEV_SERVER || 'http://localhost:3001',
        pathRewrite: { '^/remote/catalog': '' },
        changeOrigin: true,
      },
      {
        context: ['/remote/cart'],
        target: process.env.CART_DEV_SERVER || 'http://localhost:3002',
        pathRewrite: { '^/remote/cart': '' },
        changeOrigin: true,
      },
      {
        context: ['/remote/checkout'],
        target: process.env.CHECKOUT_DEV_SERVER || 'http://localhost:3003',
        pathRewrite: { '^/remote/checkout': '' },
        changeOrigin: true,
      },
    ],
  },
  devtool: isProd ? 'source-map' : 'eval-source-map',
};
