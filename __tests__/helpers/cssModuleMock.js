// CSS Modules のモック — クラス名をそのまま文字列として返す
module.exports = new Proxy(
  {},
  {
    get: function (_, className) {
      return className;
    },
  }
);
