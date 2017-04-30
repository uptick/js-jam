require( 'isomorphic-fetch' )
console.debug = () => {}
var jsdom = require( 'jsdom-global' )()  // must come first
var assert = require( 'chai' ).assert

import DB from '../src/db'
import {schema, getMovieData} from './movie-fixture'

describe( 'sync', function() {

  describe( 'workflows', function() {

    it( 'basic commit', function() {
      let db = schema.db()
      db.loadJsonApi( getMovieData() )
    })
  })
})
