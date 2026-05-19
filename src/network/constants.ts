/**
 * Return this symbol from a dynamic response closure to explicitly bypass the current mock.
 * This instructs Lupa to fall through to the next registered mock, or defer to the real network.
 */
export const bypass: unique symbol = Symbol.for('lupa.network.bypass')
