require( 'isomorphic-fetch' );
console.debug = () => {};
var assert = require( 'chai' ).assert;
import { Set } from 'immutable';
import Model from '../src/model';
import Table from '../src/table';
import DB from '../src/db';
import { splitJsonApiResponse, makeId } from '../src/utils';

import { schema, getJsonApiData } from './model-fixture';

describe( 'Model', function() {
  const db = new DB( null, {schema} );
  db.loadJsonApi( getJsonApiData() );

  describe( 'diff', function() {

    it( 'can make creation diffs', function() {
      let data = splitJsonApiResponse( getJsonApiData() );
      let tbl = new Table( 'book', {data: data.book, db, indices: ['id', 'name']} );
      let toObj = tbl.get( 1 );
      let model = tbl.model;
      let fromObj = undefined;
      let diff = model.diff( fromObj, toObj );
      assert.deepEqual( diff._type, [undefined, 'book'] );
      assert.deepEqual( diff.id, [undefined, 1] );
      assert.deepEqual( diff.title, [undefined, 'Raw Shark'] );
      assert.deepEqual( diff.pages, [undefined, 100] );
      assert.deepEqual( diff.author[0], undefined );
      assert.deepEqual( diff.author[1].toJS(), [{_type: 'author', id: 1}] );
    });

    it( 'can make removal diffs', function() {
      let data = splitJsonApiResponse( getJsonApiData() );
      let tbl = new Table( 'book', {data: data.book, db, indices: ['id', 'name']} );
      let toObj = tbl.get( 1 );
      let model = tbl.model;
      let fromObj = undefined;
      let diff = model.diff( toObj, fromObj );
      assert.deepEqual( diff._type, ['book', undefined] );
      assert.deepEqual( diff.id, [1, undefined] );
      assert.deepEqual( diff.title, ['Raw Shark', undefined] );
      assert.deepEqual( diff.pages, [100, undefined] );
      assert.deepEqual( diff.author[1], undefined );
      assert.deepEqual( diff.author[0].toJS(), [{_type: 'author', id: 1}] );
    });

    it( 'can make update diffs', function() {
      let data = splitJsonApiResponse( getJsonApiData() );
      let tbl = new Table( 'book', {data: data.book, db, indices: ['id', 'name']} );
      let fromObj = tbl.get( 2 );
      let model = tbl.model;
      let toObj = fromObj.set( 'pages', 400 )
                         .set( 'author', fromObj.author
                                                .add( makeId( 'author', 1 ) )
                                                .delete( makeId( 'author', 2 ) ) );
      let diff = model.diff( fromObj, toObj );
      assert.deepEqual( diff._type, ['book', 'book'] );
      assert.deepEqual( diff.id, [2, 2] );
      assert.deepEqual( diff.title, undefined );
      assert.deepEqual( diff.pages, [300, 400] );
      assert.deepEqual( diff.author[0].toJS(), [{_type: 'author', id: 2}] );
      assert.deepEqual( diff.author[1].toJS(), [{_type: 'author', id: 1}] );
    });

    it( 'returns undefined if no differences', function() {
      let data = splitJsonApiResponse( getJsonApiData() );
      let tbl = new Table( 'book', {data: data.book, db, indices: ['id', 'name']} );
      let obj = tbl.get( 2 );
      let model = tbl.model;
      assert.equal( model.diff( obj, obj ), undefined );
    });
  });
});
