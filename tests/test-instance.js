require( 'isomorphic-fetch' )
console.debug = () => {}
var jsdom = require( 'jsdom-global' )()  // must come first
var assert = require( 'chai' ).assert
import { Set } from 'immutable'

import DB from '../src/db'
import { makeId } from '../src/utils'
import { schema, getJsonApiData } from './model-fixture'

describe( 'Instance', () => {

  describe( 'foreign-key', () => {

    it( 'get returns instance', () => {
      let db = new DB( null, {schema} )
      db.loadJsonApi( getJsonApiData() )
      let book = db.getInstance( 'book', 1 )
      assert.notEqual( book.next, undefined )
      assert.notEqual( book.next._db, undefined )
    })

    it( 'get returns undefined if nothing there', () => {
      let db = new DB( null, {schema} )
      db.loadJsonApi( getJsonApiData() )
      let book = db.getInstance( 'book', 1 )
      assert.equal( book.authorFK, undefined )
    })

  })

})
