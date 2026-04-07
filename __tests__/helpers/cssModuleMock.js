// CSS Modules のモック — クラス名をそのまま文字列として返す
//
// `import styles from '...'` (ESM default import) と
// `require('...')` (CommonJS) の両方に対応するため、
// __esModule: true と default プロパティに Proxy を設定している。
// esModuleInterop: true の ts-jest 環境では、CommonJS の module.exports.default が
// ESM の default import として解決される。

const proxy = new Proxy(
  {},
  {
    get: function (_, className) {
      if (className === '__esModule') return true;
      if (className === 'default') return proxy;
      return typeof className === 'string' ? className : undefined;
    },
  }
);

module.exports = proxy;
