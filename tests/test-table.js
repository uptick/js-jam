require( 'isomorphic-fetch' );
console.debug = () => {};
var assert = require( 'chai' ).assert;
import {Set} from 'immutable';
import Table from '../src/table';
import {ID, makeId, splitJsonApiResponse} from '../src/utils';

import {schema, getJsonApiData} from './model-fixture';

describe( 'Table', function() {

  describe( 'constructor', function() {

    it( 'works with mixed indices', function() {
      let data = splitJsonApiResponse( getJsonApiData() );
      let tbl = new Table( 'book', {data: data.book, schema, indices: ['id', 'title']} );
      assert.deepEqual( tbl.data.getIn( ['objects', 0, '_type'] ), 'book' );
      assert.deepEqual( tbl.data.getIn( ['objects', 0, 'id'] ), 1 );
      assert.deepEqual( tbl.data.getIn( ['objects', 0, 'pages'] ), 100 );
      assert.deepEqual( tbl.data.getIn( ['objects', 0, 'title'] ), 'Raw Shark' );
      assert.deepEqual( tbl.data.getIn( ['objects', 0, 'author'] ).toJS(), [{_type: 'author', id: 1}] );
      assert.deepEqual( tbl.data.getIn( ['objects', 1, '_type'] ), 'book' );
      assert.deepEqual( tbl.data.getIn( ['objects', 1, 'id'] ), 2 );
      assert.deepEqual( tbl.data.getIn( ['objects', 1, 'pages'] ), 300 );
      assert.deepEqual( tbl.data.getIn( ['objects', 1, 'title'] ), 'Hyperion' );
      assert.deepEqual( tbl.data.getIn( ['objects', 1, 'author'] ).toJS(), [{_type: 'author', id: 2}, {_type: 'author', id: 3}] );
      assert.deepEqual( tbl.data.getIn( ['indices', 'id'] ).toJS(), {1: [0], 2: [1], 3: [2]} );
      assert.deepEqual( tbl.data.getIn( ['indices', 'title'] ).toJS(), {Blah: [2], Hyperion: [1], 'Raw Shark': [0]} );
    });

    it( 'works with overlapping indices', function() {
      let data = splitJsonApiResponse( getJsonApiData() );
      let tbl = new Table( 'author', {data: data.author, schema, indices: ['id', 'name']} );
      assert.deepEqual( tbl.data.getIn( ['indices', 'id'] ).toJS(), {1: [0], 2: [1], 3: [2]} );
      assert.deepEqual( tbl.data.getIn( ['indices', 'name'] ).toJS(), {Frank: [0, 2], Harry: [1]} );
    });
  });

  describe( 'filter', function() {
    let data = splitJsonApiResponse( getJsonApiData() );
    let tbl = new Table( 'author', {data: data.author, schema, indices: ['id', 'name']} );

    it( 'works with ID', function() {
      assert.deepEqual( tbl.filter( 1 ).first().id, 1 );
      assert.deepEqual( tbl.filter( 2 ).first().id, 2 );
    });

    it( 'works with name', function() {
      assert.deepEqual( tbl.filter( {name: 'Frank'} ).toJS()[0].id, 1 );
      assert.deepEqual( tbl.filter( {name: 'Frank'} ).toJS()[1].id, 3 );
      assert.deepEqual( tbl.filter( {name: 'Harry'} ).toJS()[0].id, 2 );
    });

    it( 'works with both id and name', function() {
      assert.deepEqual( tbl.filter( {id: 3, name: 'Frank'} ).toJS()[0].id, 3 );
      assert.deepEqual( tbl.filter( {id: 2, name: 'Frank'} ).toJS(), [] );
    });

    it( 'works with foreign-keys', function() {
      data = splitJsonApiResponse( getJsonApiData() );
      tbl = new Table(
        'book',
        {data: data.book, schema, indices: ['id', 'title', 'next']}
      );
      assert.deepEqual( tbl.filter( {next: makeId( 'book', 2 )} ).toJS()[0].id, 1 );
    });
  });

  describe( 'get', function() {
    let data = splitJsonApiResponse( getJsonApiData() );
    let tbl = new Table( 'author', {data: data.author, schema, indices: ['id', 'name']} );

    it( 'gets a single object', function() {
      assert.deepEqual( tbl.get( 1 ).id, 1 );
      assert.deepEqual( tbl.get( {name: 'Harry'} ).id, 2 );
    });
  });

  describe( 'set', function() {

    it( 'adds new objects', function() {
      let tbl = new Table( 'author', {data: [], schema, indices: ['id', 'name']} );
      tbl.set( {id: 10, _type: 'author', name: 'Joe'} );
      tbl.set( {id: 20, _type: 'author', name: 'Bill'} );
      tbl.set( {id: 30, _type: 'author', name: 'Joe'} );
      assert.deepEqual( tbl.get( 10 ).id, 10 );
      assert.deepEqual( tbl.get( 10 ).name, 'Joe' );
      assert.deepEqual( tbl.get( 20 ).name, 'Bill' );
      assert.deepEqual( tbl.get( 30 ).id, 30 );
      assert.deepEqual( tbl.get( 30 ).name, 'Joe' );
      assert.deepEqual( tbl.filter( {name: 'Joe'} ).toJS().map( x => x.id ), [10, 30] );
    });

    it( 'updates existing objects', function() {
      let tbl = new Table( 'author', {data: [], schema, indices: ['id', 'name']} );
      tbl.set( {id: 10, _type: 'author', name: 'Joe'} );
      tbl.set( {id: 20, _type: 'author', name: 'Bill'} );
      tbl.set( {id: 30, _type: 'author', name: 'Joe'} );
      tbl.set( {id: 30, _type: 'author', name: 'Bill'} );
      tbl.set( {id: 10, _type: 'author', name: 'Sue'} );
      assert.deepEqual( tbl.get( 10 ).id, 10 );
      assert.deepEqual( tbl.get( 10 ).name, 'Sue' );
      assert.deepEqual( tbl.get( 20 ).id, 20 );
      assert.deepEqual( tbl.get( 20 ).name, 'Bill' );
      assert.deepEqual( tbl.get( 30 ).id, 30 );
      assert.deepEqual( tbl.get( 30 ).name, 'Bill' );
      assert.deepEqual( tbl.filter( {name: 'Bill'} ).toJS().map( x => x.id ), [20, 30] );
    });
  });

  describe( 'remove', function() {

    it( 'removes many', function() {
      let data = splitJsonApiResponse( getJsonApiData() );
      let tbl = new Table( 'author', {data: data.author, schema, indices: ['id', 'name']} );
      tbl.remove( 3 );
      assert.deepEqual( tbl.get( 3 ), undefined );
      tbl.remove( 1 );
      assert.deepEqual( tbl.get( 3 ), undefined );
      assert.deepEqual( tbl.get( 2 ).id, 2 );
    });
  });

  describe( 'reId', function() {

    it( 'works', function() {
      let data = splitJsonApiResponse( getJsonApiData() );
      let tbl = new Table( 'author', {data: data.author, schema, indices: ['id', 'name']} );
      tbl.reId( 2, 20 );
      assert.deepEqual( tbl.get( 2 ), undefined );
      assert.deepEqual( tbl.get( 20 ).id, 20 );
      tbl.set( {id: 2, _type: 'author', name: 'Louie'} );
      assert.deepEqual( tbl.get( 2 ).name, 'Louie' );
      assert.deepEqual( tbl.get( 20 ).id, 20 );
    });
  });

  describe( 'addRelationship', function() {

    it( 'works', function() {
      let data = splitJsonApiResponse( getJsonApiData() );
      let tbl = new Table( 'book', {data: data.book, schema, indices: ['id', 'name']} );
      tbl.addRelationship( 1, 'author', {_type: 'author', id: 2} );
      assert.deepEqual( tbl.get( 1 ).author.toJS()[1].id, 2 );
      tbl.addRelationship( 1, 'author', ID( {_type: 'author', id: 3} ) );
      assert.deepEqual( tbl.get( 1 ).author.toJS()[2].id, 3 );
    });
  });

  describe( 'removeRelationship', function() {

    it( 'works', function() {
      let data = splitJsonApiResponse( getJsonApiData() );
      let tbl = new Table( 'book', {data: data.book, schema, indices: ['id', 'name']} );
      tbl.addRelationship( 1, 'author', {_type: 'author', id: 2} );
      tbl.addRelationship( 1, 'author', ID( {_type: 'author', id: 3} ) );
      assert.deepEqual( tbl.get( 1 ).author.toJS()[1].id, 2 );
      assert.deepEqual( tbl.get( 1 ).author.toJS()[2].id, 3 );
      tbl.removeRelationship( 1, 'author', {_type: 'author', id: 2} );
      assert.deepEqual( tbl.get( 1 ).author.toJS()[1].id, 3 );
      tbl.removeRelationship( 1, 'author', ID( {_type: 'author', id: 3} ) );
      assert.deepEqual( tbl.get( 1 ).author.toJS()[1], undefined );
    });
  });

  describe( 'applyDiff', function() {

    it( 'creates correctly', function() {
      const createDiff = {
        _type: [undefined, 'book'],
        id: [undefined, 'aaa'],
        title: [undefined, 'A New Book'],
        author: [new Set(), new Set( [{_type: 'author', id: 2}] )]
      };
      let data = splitJsonApiResponse( getJsonApiData() );
      let tbl = new Table( 'book', {data: data.book, schema, indices: ['id', 'name']} );
      tbl.applyDiff( createDiff );
      assert.equal( tbl.get( 'aaa' ).id, 'aaa' );
      assert.equal( tbl.get( 'aaa' ).title, 'A New Book' );
      assert.deepEqual( tbl.get( 'aaa' ).author.toJS(), [{_type: 'author', id: 2}] );
    });

    it( 'removes correctly', function() {
      const removeDiff = {
        _type: ['book', undefined],
        id: [1, undefined]
      };
      let data = splitJsonApiResponse( getJsonApiData() );
      let tbl = new Table( 'book', {data: data.book, schema, indices: ['id', 'name']} );
      tbl.applyDiff( removeDiff );
      assert.equal( tbl.get( 1 ), undefined );
    });

    it( 'updates correctly', function() {
      const updateDiff = {
        _type: ['book', 'book'],
        id: [1, 1],
        title: ['Raw Shark', 'Blah'],
        author: [new Set( [{_type: 'author', id: 1}] ),
                 new Set( [{_type: 'author', id: 2}, {_type: 'author', id: 3}] )]
      };
      let data = splitJsonApiResponse( getJsonApiData() );
      let tbl = new Table( 'book', {data: data.book, schema, indices: ['id', 'name']} );
      tbl.applyDiff( updateDiff );
      assert.equal( tbl.get( 1 ).id, 1 );
      assert.equal( tbl.get( 1 ).title, 'Blah' );
      assert.deepEqual( tbl.get( 1 ).author.toJS(), [{_type: 'author', id: 2}, {_type: 'author', id: 3}] );
    });
  });
});
