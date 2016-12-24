require( 'isomorphic-fetch' );
console.debug = () => {};
var jsdom = require( 'jsdom-global' )();  // must come first
var assert = require( 'chai' ).assert;
var nock = require( 'nock' );
import { Set } from 'immutable';

import DB from '../src/db';
import { makeId } from '../src/utils';
import { schema, getJsonApiData } from './model-fixture';

/* describe( 'Model', function() {

   describe( 'toJsonApi', function() {

   it( 'sets single relationship', function() {
   const model = schema.getModel( 'book' );
   const data = model.toJsonApi({
   _type: 'book',
   id: 1,
   title: 'test',
   author: {
   id: 1,
   type: 'author'
   }
   });
   assert.deepEqual( data, {
   type: 'book',
   id: 1,
   attributes: {
   title: 'test'
   },
   relationships: {
   author: {
   data: {
   id: 1,
   type: 'author'
   }
   }
   }
   });
   });

   it( 'sets multiple relationships', function() {
   const model = schema.getModel( 'book' );
   const data = model.toJsonApi({
   _type: 'book',
   id: 1,
   title: 'test',
   author: [{
   id: 1,
   type: 'author'
   }, {
   id: 2,
   type: 'author'
   }]
   });
   assert.deepEqual( data, {
   type: 'book',
   id: 1,
   attributes: {
   title: 'test'
   },
   relationships: {
   author: {
   data: [{
   id: 1,
   type: 'author'
   }, {
   id: 2,
   type: 'author'
   }]
   }
   }
   });
   });
   });
   }); */

describe( 'DB', function() {

  describe( 'constructor', function() {

    /* it( 'accepts raw data objects', function() {
       let db = new DB( fixture.getTestData() );
       assert.deepEqual( db.data, fixture.getTestData() );
       }); */

    /* it( 'accepts React components', function() {
       let db = new DB( testComponent );
       assert.equal( db.data, testData );
       assert.equal( db.component, testComponent );
       assert.equal( db.useState, false );
       });

       it( 'uses state when requested', function() {
       let db = new DB( testComponent, true );
       assert.equal( db.data, testStateData );
       assert.equal( db.component, testComponent );
       assert.equal( db.useState, true );
       }); */
  });

  describe( 'loadJsonApi', function() {

    it( 'loads single object while empty', function() {
      let db = new DB( null, {schema} );
      let fix = getJsonApiData();
      fix.data = fix.data[0];
      db.loadJsonApi( fix );
      const model = schema.getModel( 'book' );
      assert.equal( db.get( 'book', 1 ).id, 1 );
      assert.equal( db.get( 'book', 1 ).title, 'Raw Shark' );
      assert.equal( db.get( 'book', 1 ).author.size, 1 );
      assert.equal( db.get( 'author', 1 ).id, 1 );
      assert.equal( db.get( 'author', 1 ).name, 'Frank' );
      assert.equal( db.get( 'author', 1 ).books.size, 1 );
    });

    it( 'loads multiple objects', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      assert.deepEqual( db.get( 'book', 1 ).title, 'Raw Shark' );
      assert.deepEqual( db.get( 'book', 2 ).title, 'Hyperion' );
      assert.deepEqual( db.get( 'author', 1 ).name, 'Frank' );
      assert.deepEqual( db.get( 'author', 2 ).name, 'Harry' );
      assert.deepEqual( db.get( 'author', 3 ).name, 'Frank' );
      assert.deepEqual( db.get( 'author', 1 ).books.toJS(), [{_type: 'book', id: 1}, {_type: 'book', id: 3}] );
      assert.deepEqual( db.get( 'author', 2 ).books.toJS(), [{_type: 'book', id: 2}] );
    });
  });

  describe( 'applyDiff', function() {

    it( 'works', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      let obj = db.get( 'book', 2 );
      let newObj = obj.set( 'pages', 400 )
                      .set( 'author', obj.author
                                         .delete( makeId( 'author', 2 ) )
                                         .add( makeId( 'author', 1 ) ) );
      const model = schema.getModel( obj._type );
      let diff = model.diff( obj, newObj );
      db.applyDiff( diff );
      assert.deepEqual( db.get( 'book', 2 ).pages, 400 );
      assert.deepEqual( db.get( 'book', 2 ).author.toJS(), [{_type: 'author', id: 3}, {_type: 'author', id: 1}] );
      assert.deepEqual( db.get( 'author', 2 ).books.toJS(), [] );
      assert.deepEqual( db.get( 'author', 1 ).books.toJS(), [{_type: 'book', id: 1}, {_type: 'book', id: 3}, {_type: 'book', id: 2}] );
    });
  });

  describe( 'update', function() {

    it( 'updates existing objects from single object', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      let obj = db.get( 'book', 2 );
      obj = obj.set( 'title', 'Testing' );
      db.update( obj );
      assert.equal( db.data.getIn( ['chain', 'current'] ), 1 );
      assert.equal( db.data.getIn( ['chain', 'diffs'] ).size, 1 );
    });
    
    it( 'updates existing objects from partial', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      let obj = db.get( 'book', 2 );
      db.update( obj, {title: 'Testing'} );
      assert.equal( db.data.getIn( ['chain', 'current'] ), 1 );
      assert.equal( db.data.getIn( ['chain', 'diffs'] ).size, 1 );
    });
  });

  describe( 'create', function() {

    it( 'works', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      const id = db.create( {_type: 'book', title: 'Hello', pages: '200'} );
      assert.equal( db.data.getIn( ['chain', 'current'] ), 1 );
      assert.equal( db.data.getIn( ['chain', 'diffs'] ).size, 1 );
      assert.deepEqual( db.get( id ).id, id.id );
      assert.deepEqual( db.get( id ).title, 'Hello' );
    });
  });

  describe( 'undo', function() {

    it( 'does nothing if no diffs', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      assert.equal( db.get( 'book', 1 ).pages, 100 );
      db.undo();
      assert.equal( db.get( 'book', 1 ).pages, 100 );
    });

    it( 'works once', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.update( makeId( 'book', 1 ), {pages: 1000} );
      assert.equal( db.get( 'book', 1 ).pages, 1000 );
      db.undo();
      assert.equal( db.get( 'book', 1 ).pages, 100 );
      assert.equal( db.data.getIn( ['chain', 'current'] ), 0 );
    });

    it( 'works across models', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.update( makeId( 'book', 1 ), {pages: 1000} );
      db.update( makeId( 'author', 3 ), {name: 'Bobby'} );
      assert.equal( db.get( 'book', 1 ).pages, 1000 );
      assert.equal( db.get( 'author', 3 ).name, 'Bobby' );
      db.undo();
      assert.equal( db.get( 'author', 3 ).name, 'Frank' );
      db.undo();
      assert.equal( db.get( 'book', 1 ).pages, 100 );
      db.undo();
      assert.equal( db.get( 'author', 3 ).name, 'Frank' );
      assert.equal( db.get( 'book', 1 ).pages, 100 );
    });

    it( 'works with created objects', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      const id = db.create( {_type: 'book', title: 'New'} );
      assert.equal( db.get( id ).title, 'New' );
      db.undo();
      assert.equal( db.get( id ), undefined );
    });

    it( 'works with removed objects', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      assert.notEqual( db.get( 'book', 1 ), undefined );
      db.remove( 'book', 1 );
      assert.equal( db.get( 'book', 1 ), undefined );
      db.undo();
      assert.notEqual( db.get( 'book', 1 ), undefined );
    });
  });

  describe( 'redo', function() {

    it( 'does nothing if no diffs', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      assert.equal( db.get( 'book', 1 ).pages, 100 );
      db.redo();
      assert.equal( db.get( 'book', 1 ).pages, 100 );
    });

    it( 'does nothing if no undone diffs', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.update( makeId( 'book', 1 ), {pages: 1000} );
      db.redo();
      assert.equal( db.get( 'book', 1 ).pages, 1000 );
    });

    it( 'works once', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.update( makeId( 'book', 1 ), {pages: 1000} );
      assert.equal( db.get( 'book', 1 ).pages, 1000 );
      db.undo();
      assert.equal( db.get( 'book', 1 ).pages, 100 );
      db.redo();
      assert.equal( db.get( 'book', 1 ).pages, 1000 );
    });

    it( 'works across models', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.update( makeId( 'book', 1 ), {pages: 1000} );
      db.update( makeId( 'author', 3 ), {name: 'Bobby'} );
      assert.equal( db.get( 'book', 1 ).pages, 1000 );
      assert.equal( db.get( 'author', 3 ).name, 'Bobby' );
      db.undo();
      assert.equal( db.get( 'book', 1 ).pages, 1000 );
      assert.equal( db.get( 'author', 3 ).name, 'Frank' );
      db.undo();
      assert.equal( db.get( 'book', 1 ).pages, 100 );
      assert.equal( db.get( 'author', 3 ).name, 'Frank' );
      db.redo();
      assert.equal( db.get( 'book', 1 ).pages, 1000 );
      assert.equal( db.get( 'author', 3 ).name, 'Frank' );
      db.redo();
      assert.equal( db.get( 'book', 1 ).pages, 1000 );
      assert.equal( db.get( 'author', 3 ).name, 'Bobby' );
    });

    it( 'works with created objects', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      const id = db.create( {_type: 'book', title: 'New'} );
      assert.equal( db.get( id ).title, 'New' );
      db.undo();
      assert.equal( db.get( id ), undefined );
      db.redo();
      assert.equal( db.get( id ).title, 'New' );
    });

    it( 'works with removed objects', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      assert.notEqual( db.get( 'book', 1 ), undefined );
      db.remove( 'book', 1 );
      assert.equal( db.get( 'book', 1 ), undefined );
      db.undo();
      assert.notEqual( db.get( 'book', 1 ), undefined );
      db.redo();
      assert.equal( db.get( 'book', 1 ), undefined );
    });
  });

  describe( 'undoAll/redoAll', function() {

    it( 'works', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.update( makeId( 'book', 1 ), {pages: 1000} );
      db.update( makeId( 'author', 3 ), {name: 'Bobby'} );
      assert.equal( db.get( 'book', 1 ).pages, 1000 );
      assert.equal( db.get( 'author', 3 ).name, 'Bobby' );
      db.undoAll();
      assert.equal( db.get( 'book', 1 ).pages, 100 );
      assert.equal( db.get( 'author', 3 ).name, 'Frank' );
      db.redoAll();
      assert.equal( db.get( 'book', 1 ).pages, 1000 );
      assert.equal( db.get( 'author', 3 ).name, 'Bobby' );
      db.undoAll();
      assert.equal( db.get( 'book', 1 ).pages, 100 );
      assert.equal( db.get( 'author', 3 ).name, 'Frank' );
      db.redoAll();
      assert.equal( db.get( 'book', 1 ).pages, 1000 );
      assert.equal( db.get( 'author', 3 ).name, 'Bobby' );
    });
  });

  describe( 'reId', function() {

    it( 'works', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.reId( 'book', 2, 20 );
      assert.deepEqual( db.get( 'book', 2 ), undefined );
      assert.deepEqual( db.get( 'book', 20 ).id, 20 );
      assert.deepEqual( db.get( 'author', 2 ).books.has( makeId( 'book', 2 ) ), false );
      assert.deepEqual( db.get( 'author', 2 ).books.has( makeId( 'book', 20 ) ), true );
      assert.deepEqual( db.get( 'author', 3 ).books.has( makeId( 'book', 2 ) ), false );
      assert.deepEqual( db.get( 'author', 3 ).books.has( makeId( 'book', 20 ) ), true );
    });

    it( 'works with many-to-many diffs', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.update( makeId( 'author', 2 ), {name: 'Buster'} );
      db.update( makeId( 'book', 1 ), {author: db.get( 'book', 1 ).author.add( makeId( 'author', 2 ) )} );
      db.reId( 'author', 2, 20 );
      assert.deepEqual( db.get( 'author', 2 ), undefined );
      assert.deepEqual( db.get( 'author', 20 ).id, 20 );
      assert.equal( db.data.getIn( ['chain', 'diffs', 1] ).author[1].has( makeId( 'author', 2 ) ), false );
      assert.equal( db.data.getIn( ['chain', 'diffs', 1] ).author[1].has( makeId( 'author', 20 ) ), true );
    });

    it( 'works with foreign-keys', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      const id = db.create( {_type: 'book', title: 'Testing'} );
      const otherId = db.create( {_type: 'book', title: 'Testing', next: id} );
      assert.deepEqual( db.get( 'book', otherId.id ).next.equals( id ), true );
      db.reId( 'book', id.id, 20 );
      assert.deepEqual( db.get( 'book', id.id ), undefined );
      assert.deepEqual( db.get( 'book', 20 ).id, 20 );
      assert.deepEqual( db.get( 'book', otherId.id ).next.equals( makeId( 'book', 20 ) ), true );
      assert.equal( db.data.getIn( ['chain', 'diffs', 1] ).next[1].equals( makeId( 'book', 20 ) ), true );
    });
  });

  describe( 'commitDiff', function() {
    nock( /.*/ )
           .get( /.*/ )
           .reply( 201, { data: { id: 100 }});

    it( 'create diff aliases ID', function( done ) {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      const id = db.create( {_type: 'book', title: 'Testing'} );
      db.commitDiff()
        .then( response => {
          assert.equal( db.get( id ), undefined );
          assert.equal( db.get( 'book', 100 ).id, 100 );
          assert.equal( db.get( 'book', 100 ).title, 'Testing' );
          assert.equal( db.data.getIn( ['chain', 'diffs', 0] ).id[1], 100 );
          assert.equal( db.data.getIn( ['chain', 'server'] ), 1 );
          done();
        })
        .catch( e => done( e ) );
    });

//    nock( /.*/ )
//           .get( /.*/ )
//           .reply( 201, { data: { id: 100 }});

  /* it( 'create diff changes other diff IDs', function( done ) {
     let db = new DB();
     db.loadJsonApi( fixture.getJsonApi() );
     const id = db.set( 'book', {title: 'Testing'} );
     db.set( 'book', {id, title: 'Nope'} );
     db.set( 'book', {title: 'Another'} );
     db.commitDiff()
     .then( response => {
     db.postCommitDiff( db.data.chain.diffs[0][1], response );
     db.popDiff();
     assert.equal( db.get( 'book', id ).id, 100 );
     assert.equal( db.get( 'book', id ).title, 'Nope' );
     assert.equal( db.get( 'book', 100 ).id, 100 );
     assert.equal( db.get( 'book', 100 ).title, 'Nope' );
     assert.equal( db.data.chain.diffs[0][0].object.id, 100 );
     assert.equal( db.data.chain.diffs[0][1].object.id, 100 );
     assert.equal( db.data.chain.diffs[1][0].object.id, 100 );
     assert.equal( db.data.chain.diffs[1][1].object.id, 100 );
     assert.notEqual( db.data.chain.diffs[2][0].object.id, 100 );
     assert.notEqual( db.data.chain.diffs[2][1].object.id, 100 );
     done();
     })
     .catch( e => done( e ) );
     }); */
  });

  /* describe( 'goto', function() {

     it( 'undoes operations', function() {
     let db = new DB();
     db.loadJsonApi( fixture.getJsonApi() );
     db.set( 'book', {id: 1, size: 1000} );
     db.set( 'author', {id: 3, name: 'Bobby'} );
     assert.equal( db.get( 'book', 1 ).size, 1000 );
     assert.equal( db.get( 'author', 3 ).name, 'Bobby' );
     db.goto( 1 );
     assert.equal( db.get( 'book', 1 ).size, 1000 );
     assert.equal( db.get( 'author', 3 ).name, 'Larry' );
     db.goto( 0 );
     assert.equal( db.get( 'book', 1 ).size, 100 );
     assert.equal( db.get( 'author', 3 ).name, 'Larry' );
     });

     it( 'undoes multiple operations', function() {
     let db = new DB();
     db.loadJsonApi( fixture.getJsonApi() );
     db.set( 'book', {id: 1, size: 1000} );
     db.set( 'author', {id: 3, name: 'Bobby'} );
     assert.equal( db.get( 'book', 1 ).size, 1000 );
     assert.equal( db.get( 'author', 3 ).name, 'Bobby' );
     db.goto( 0 );
     assert.equal( db.get( 'book', 1 ).size, 100 );
     assert.equal( db.get( 'author', 3 ).name, 'Larry' );
     });

     it( 'redoes operations', function() {
     let db = new DB();
     db.loadJsonApi( fixture.getJsonApi() );
     db.set( 'book', {id: 1, size: 1000} );
     db.set( 'author', {id: 3, name: 'Bobby'} );
     db.undoAll();
     assert.equal( db.get( 'book', 1 ).size, 100 );
     assert.equal( db.get( 'author', 3 ).name, 'Larry' );
     db.goto( 1 );
     assert.equal( db.get( 'book', 1 ).size, 1000 );
     assert.equal( db.get( 'author', 3 ).name, 'Larry' );
     db.goto( 2 );
     assert.equal( db.get( 'book', 1 ).size, 1000 );
     assert.equal( db.get( 'author', 3 ).name, 'Bobby' );
     });

     it( 'redoes multiple operations', function() {
     let db = new DB();
     db.loadJsonApi( fixture.getJsonApi() );
     db.set( 'book', {id: 1, size: 1000} );
     db.set( 'author', {id: 3, name: 'Bobby'} );
     db.undoAll();
     assert.equal( db.get( 'book', 1 ).size, 100 );
     assert.equal( db.get( 'author', 3 ).name, 'Larry' );
     db.goto( 2 );
     assert.equal( db.get( 'book', 1 ).size, 1000 );
     assert.equal( db.get( 'author', 3 ).name, 'Bobby' );
     });
     }); */

  describe( 'get', function() {

    it( 'accepts split type and ID', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      assert.equal( db.get( 'book', 1 ).id, 1 );
    });

    it( 'accepts ID object', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      assert.equal( db.get( {_type: 'book', id: 1} ).id, 1 );
    });

    it( 'accepts ID record', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      assert.equal( db.get( makeId( 'book', 1 ) ).id, 1 );
    });
  });

  describe( 'withBlock', function() {

    it( 'keeps diffs if not rolled back', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.update( makeId( 'book', 1 ), {title: 'Testing'} );
      db.withBlock( () => {
        db.update( makeId( 'author', 1 ), {name: 'Billy'} );
        db.update( makeId( 'book', 1 ), {title: 'Testing2'} );
      });
      assert.equal( db.get( 'book', 1 ).title, 'Testing2' );
      assert.equal( db.get( 'author', 1 ).name, 'Billy' );
      assert.equal( db.data.getIn( ['chain', 'diffs'] ).size, 3 );
      assert.deepEqual( db.data.getIn( ['chain', 'blocks'] ).toJS(), [1] );
    });

    it( 'abandons diffs if rolled back', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.update( makeId( 'book', 1 ), {title: 'Testing'} );
      db.withBlock( () => {
        db.update( makeId( 'author', 1 ), {name: 'Billy'} );
        db.update( makeId( 'book', 1 ), {title: 'Testing2'} );
        throw new DB.Rollback();
      });
      assert.equal( db.get( 'book', 1 ).title, 'Testing' );
      assert.notEqual( db.get( 'author', 1 ).name, 'Billy' );
      assert.equal( db.data.getIn( ['chain', 'diffs'] ).size, 1 );
      assert.deepEqual( db.data.getIn( ['chain', 'blocks'] ).toJS(), [] );
    });

    it( 'can create multiple groups', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.update( makeId( 'book', 1 ), {title: 'Testing'} );
      db.withBlock( () => {
        db.update( makeId( 'author', 1 ), {name: 'Billy'} );
        db.update( makeId( 'book', 1 ), {title: 'Testing2'} );
      });
      db.withBlock( () => {
        db.update( makeId( 'author', 1 ), {name: 'Franko'} );
        db.update( makeId( 'book', 1 ), {title: 'Testing3'} );
      });
      assert.equal( db.get( 'book', 1 ).title, 'Testing3' );
      assert.equal( db.get( 'author', 1 ).name, 'Franko' );
      assert.equal( db.data.getIn( ['chain', 'diffs'] ).size, 5 );
      assert.deepEqual( db.data.getIn( ['chain', 'blocks'] ).toJS(), [1, 3] );
    });
  });

  describe( 'addBlock', function() {

    it( 'works', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      db.withBlock( () => {
        db.update( makeId( 'author', 1 ), {name: 'Billy'} );
      });
      db.withBlock( () => {
        db.update( makeId( 'book', 1 ), {title: 'Testing2'} );
      });
      const blocks = db.getBlocks( 2 );
      db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      assert.notEqual( db.get( 'book', 1 ).title, 'Testing2' );
      assert.notEqual( db.get( 'author', 1 ).name, 'Billy' );
      assert.notEqual( db.data.getIn( ['chain', 'diffs'] ).size, 2 );
      assert.notDeepEqual( db.data.getIn( ['chain', 'blocks'] ).toJS(), [0, 1] );
      for( const block of blocks )
        db.addBlock( block );
      assert.equal( db.get( 'book', 1 ).title, 'Testing2' );
      assert.equal( db.get( 'author', 1 ).name, 'Billy' );
      assert.equal( db.data.getIn( ['chain', 'diffs'] ).size, 2 );
      assert.deepEqual( db.data.getIn( ['chain', 'blocks'] ).toJS(), [0, 1] );
    });
  });

  describe( 'relationships', function() {

    it( 'can use JS IDs', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      let obj = db.get( 'book', 3 );
      db.update( obj.set( 'author', obj.get( 'author' ).add( {_type: 'author', id: 2} ) ) );
      obj = db.get( 'book', 3 );
      assert.deepEqual( obj.author.toJS(), [{_type: 'author', id: 1}, {_type: 'author', id: 2}] );
      assert.equal( obj.author.toList().get( 0 ), db.data.getIn( ['ids', 'author', 1] ) );
      assert.equal( obj.author.toList().get( 1 ), db.data.getIn( ['ids', 'author', 2] ) );
    });

    it( 'do not duplicate IDs', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      let obj = db.get( 'book', 3 );
      db.update( obj.set( 'author', obj.get( 'author' ).add( {_type: 'author', id: 1} ) ) );
      obj = db.get( 'book', 3 );
      assert.deepEqual( obj.author.toJS(), [{_type: 'author', id: 1}] );
      assert.equal( obj.author.toList().get( 0 ), db.data.getIn( ['ids', 'author', 1] ) );
    });

    it( 'convert JS IDs when adding', function() {
      let db = new DB( null, {schema} );
      db.loadJsonApi( getJsonApiData() );
      let id = db.create( {_type: 'book', title: 'hello', author: [{_type: 'author', id: 1}]} );
      let obj = db.get( id );
      assert.equal( db.data.getIn( ['ids', 'author', 1] ), obj.author.first() );
    });
  });

  /* describe( 'calcOrderedDiffs', function() {

     it( 'returns empty list when no local data', function() {
     let db = new DB( emptyLocalData );
     let diffs = Array.from( db.calcOrderedDiffs() );
     assert.equal( JSON.stringify( diffs ), '[]' );
     });

     it( 'returns empty list when no changes', function() {
     let db = new DB( sameLocalData );
     let diffs = Array.from( db.calcOrderedDiffs() );
     assert.equal( JSON.stringify( diffs ), '[]' );
     });

     it( 'finds new objects', function() {
     let db = new DB( sameLocalData );
     db.set({ type: 'book', attributes: { title: 'Harry Potter' } });
     let newObj = db.data.local.book.objects.slice( -1 )[0];
     let diffs = Array.from( db.calcOrderedDiffs() );
     assert.equal( JSON.stringify( diffs ),
     JSON.stringify([{ op: 'create', model: newObj }]) );
     });

     it( 'creates update patches', function() {
     let db = new DB( sameLocalData );
     db.set({ type: 'book', id: 1, attributes: { title: 'Harry Potter' } });
     db.set({ type: 'book', id: 2, attributes: { title: 'Something' } });
     let diffs = Array.from( db.calcOrderedDiffs() );
     assert.equal( JSON.stringify( diffs ),
     JSON.stringify([{
     op: 'updated',
     model: db.data.local.book.objects[0],
     fields: [ 'title' ]
     }, {
     op: 'updated',
     model: db.data.local.book.objects[1],
     fields: [ 'title' ]
     }]) );
     });

     it( 'orders relationships', function() {
     let db = new DB( relatedData );
     let diffs = Array.from( db.calcOrderedDiffs() );
     assert.equal( JSON.stringify( diffs ),
     JSON.stringify([{
     op: 'create',
     model: db.data.local.author.objects[0]
     }, {
     op: 'create',
     model: db.data.local.book.objects[0]
     }, {
     op: 'create',
     model: db.data.local.author.objects[1]
     }, {
     op: 'create',
     model: db.data.local.book.objects[1]
     }]) );
     });
     }); */
});
