var assert = require( 'chai' ).assert

import PaginatedArray from '../src/paginated-array'

describe( 'class', () => {

  it( 'keeps Array functionality', () => {
    let pa = new PaginatedArray( 'hello', 'world' )
    assert.equal( pa[0], 'hello' )
    assert.equal( pa[1], 'world' )
    const [ a, b ] = pa
    assert.equal( a, 'hello' )
    assert.equal( b, 'world' )
  })
})

describe( 'constructor', () => {

  it( 'accepts a destructured array', () => {
    let src = [ 'hello', 'world' ]
    let pa = new PaginatedArray( ...src )
    assert.equal( pa[0], 'hello' )
    assert.equal( pa[1], 'world' )
    const [ a, b ] = pa
    assert.equal( a, 'hello' )
    assert.equal( b, 'world' )
  })
})

describe( 'getNumPages', () => {

  it( 'works', () => {
    let pa = new PaginatedArray( 'hello', 'world' )
    pa.getNumPages()
  })
})
