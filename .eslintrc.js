module.exports = {
    parser: "@babel/eslint-parser",
    plugins: ["@babel"],
    env: {
        node: true,
        es2021: true
    },
    parserOptions: {
        requireConfigFile: false,
        babelOptions: {
            presets: [["@babel/preset-env", { shippedProposals: true }]]
        }
    },
    extends: "eslint:recommended",
    rules: {
        quotes: [
            "error",
            "double"
        ],
        semi: [
            "error",
            "always"
        ]
    }
};
