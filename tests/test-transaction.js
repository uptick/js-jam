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
      /* assert.equal( db.data.getIn( ['transactions', 'test', 'chain', 'diffs'] ).size, 0 );*/
      /* assert.equal( trans.data.getIn( ['chain', 'diffs'] ).size, 1 );*/
      db.saveTransaction( trans );
      /* assert.equal( db.data.getIn( ['transactions', 'test', 'chain', 'diffs'] ).size, 1 );*/
      assert.equal( db.get( 'book', 1 ).title, 'Raw Shark' );
      assert.equal( trans.get( 'book', 1 ).title, 'Blah' );
      db.commitTransaction( 'test' );
      assert.equal( db.get( 'book', 1 ).title, 'Blah' );
      // TODO: We don't delete transactions. Maybe we should?
      // assert.equal( db.getTransaction( 'test' ), undefined );
    });

    it( 'basic abort', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.startTransaction( 'test' );
      let trans = db.getTransaction( 'test' );
      let obj = trans.get( 'book', 1 );
      trans.update( obj.set( 'title', 'Blah' ) );
      /* assert.equal( db.data.getIn( ['transactions', 'test', 'chain', 'diffs'] ).size, 0 );*/
      /* assert.equal( trans.data.getIn( ['chain', 'diffs'] ).size, 1 );*/
      db.saveTransaction( trans );
      /* assert.equal( db.data.getIn( ['transactions', 'test', 'chain', 'diffs'] ).size, 1 );*/
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
      // TODO: We don't delete transactions. Maybe we should?
      // assert.equal( db.getTransaction( 'test' ), undefined );
      // assert.equal( db.getTransaction( 'test2' ), undefined );
    });

    it( 'instances', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.startTransaction( 'test' );
      let trans = db.getTransaction( 'test' );

      let book = trans.getInstance( 'book', 1 );
      let author = trans.getInstance( 'author', 2 );
      book.title = 'Such test';
      book.author.add( author );
      book.save()

      assert.equal( trans.get( 'book', 1 ).title, 'Such test' );
      assert( trans.get( 'book', 1 ).author.has( trans.getId( author ) ) );

      db.saveTransaction( trans );
      trans = db.getTransaction( 'test' );

      assert.equal( trans.get( 'book', 1 ).title, 'Such test' );
      assert( trans.get( 'book', 1 ).author.has( trans.getId( author ) ) );

      db.commitTransaction( 'test' );

      assert.equal( db.get( 'book', 1 ).title, 'Such test' );
      assert( db.get( 'book', 1 ).author.has( db.getId( author ) ) );
    });

    it( 'loading', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.startTransaction( 'test' );
      let trans = db.getTransaction( 'test' );

      let book = trans.getInstance( 'book', 1 );
      let author = trans.getInstance( 'author', 2 );
      book.title = 'Such test';
      book.author.add( author );
      book.save()

      trans.loadJsonApi({
        data: {
          type: 'book',
          id: 102,
          attributes: {
            title: 'Mario'
          }
        }
      });

      db.saveTransaction( trans );

      assert.equal( trans.get( 'book', 1 ).title, 'Such test' );
      assert( trans.get( 'book', 1 ).author.has( trans.getId( author ) ) );
      assert.equal( trans.get( 'book', 102 ).title, 'Mario' );

      db.commitTransaction( 'test' );

      assert.equal( db.get( 'book', 1 ).title, 'Such test' );
      assert( db.get( 'book', 1 ).author.has( db.getId( author ) ) );
      assert.equal( db.get( 'book', 102 ).title, 'Mario' );
    });

    it( 'removals', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.startTransaction( 'test' );
      let trans = db.getTransaction( 'test' );

      let book = trans.getInstance( 'book', 1 );
      let author = trans.getInstance( 'author', 1 );
      author.delete()

      db.saveTransaction( trans );

      assert.equal( trans.get( 'author', 1 ), undefined );
      // TODO
      // assert.equal( trans.get( 'book', 1 ).author.has( db.getId( author ) ), false );

      db.commitTransaction( 'test' );

      assert.equal( db.get( 'author', 1 ), undefined );
    });
  });
});
