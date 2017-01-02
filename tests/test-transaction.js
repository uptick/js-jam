require( 'isomorphic-fetch' );
console.debug = () => {};
var jsdom = require( 'jsdom-global' )();  // must come first
var assert = require( 'chai' ).assert;

import DB from '../src/db';
import {schema, getJsonApiData} from './model-fixture';

describe( 'Transaction', function() {

  describe( 'workflows', function() {

    it( 'basic commit', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.startTransaction( 'test' );
      let trans = db.getTransaction( 'test' );
      let obj = trans.get( 'book', 1 );
      trans.update( obj.set( 'title', 'Blah' ) );
      assert.equal( db.data.getIn( ['transactions', 'test', 'chain', 'diffs'] ).size, 0 );
      assert.equal( trans.data.getIn( ['chain', 'diffs'] ).size, 1 );
      db.saveTransaction( trans );
      assert.equal( db.data.getIn( ['transactions', 'test', 'chain', 'diffs'] ).size, 1 );
      assert.equal( db.get( 'book', 1 ).title, 'Raw Shark' );
      assert.equal( trans.get( 'book', 1 ).title, 'Blah' );
      db.commitTransaction( 'test' );
      assert.equal( db.get( 'book', 1 ).title, 'Blah' );
      assert.equal( db.getTransaction( 'test' ), undefined );
    });

    it( 'basic abort', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.startTransaction( 'test' );
      let trans = db.getTransaction( 'test' );
      let obj = trans.get( 'book', 1 );
      trans.update( obj.set( 'title', 'Blah' ) );
      assert.equal( db.data.getIn( ['transactions', 'test', 'chain', 'diffs'] ).size, 0 );
      assert.equal( trans.data.getIn( ['chain', 'diffs'] ).size, 1 );
      db.saveTransaction( trans );
      assert.equal( db.data.getIn( ['transactions', 'test', 'chain', 'diffs'] ).size, 1 );
      assert.equal( db.get( 'book', 1 ).title, 'Raw Shark' );
      assert.equal( trans.get( 'book', 1 ).title, 'Blah' );
      db.abortTransaction( 'test' );
      assert.equal( db.get( 'book', 1 ).title, 'Raw Shark' );
      assert.equal( db.getTransaction( 'test' ), undefined );
    });

    it( 'simultaneous commits', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.startTransaction( 'test' );
      db.startTransaction( 'test2' );
      let trans = db.getTransaction( 'test' );
      let trans2 = db.getTransaction( 'test2' );
      trans.update( trans.get( 'book', 1 ).set( 'title', 'Blah' ) );
      db.saveTransaction( trans );
      trans2.update( trans2.get( 'book', 2 ).set( 'title', 'Blah2' ) );
      db.saveTransaction( trans2 );
      assert.equal( db.get( 'book', 1 ).title, 'Raw Shark' );
      assert.equal( db.get( 'book', 2 ).title, 'Hyperion' );
      assert.equal( trans.get( 'book', 1 ).title, 'Blah' );
      assert.equal( trans.get( 'book', 2 ).title, 'Hyperion' );
      assert.equal( trans2.get( 'book', 1 ).title, 'Raw Shark' );
      assert.equal( trans2.get( 'book', 2 ).title, 'Blah2' );
      db.commitTransaction( 'test' );
      db.commitTransaction( 'test2' );
      assert.equal( db.get( 'book', 1 ).title, 'Blah' );
      assert.equal( db.get( 'book', 2 ).title, 'Blah2' );
      assert.equal( db.getTransaction( 'test' ), undefined );
      assert.equal( db.getTransaction( 'test2' ), undefined );
    });
  });
});
