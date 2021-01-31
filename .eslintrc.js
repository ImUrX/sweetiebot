module.exports = {
    parser: "babel-eslint",
    globals: {
        BigInt: true
    },
    extends: "klasa",
    rules: {
        quotes: [
            "error",
            "double"
        ],
        semi: [
            "error",
            "always"
        ],
        complexity: [
            "off"
        ],
        "keyword-spacing": [
            "off"
        ]
    }
};
