require( 'isomorphic-fetch' );
console.debug = () => {};
var jsdom = require( 'jsdom-global' )();  // must come first
var assert = require( 'chai' ).assert;

import DB from '../src/db';
import {schema, getJsonApiData} from './model-fixture';

describe( 'commit', function() {

  it( 'basic', function() {
    let db = new DB( null, {schema} );
    db.loadJsonApi( getJsonApiData() );

    db.startTransaction( 'test' );
    let trans = db.getTransaction( 'test' );
    let newAuthor = trans.create( {_type: 'author', name: 'New Guy'} )
    let book = trans.getInstance( 'book', 1 );
    book.title = 'Change title';
    book.author.add( newAuthor );
    book.save()
    db.saveTransaction( trans );
    db.commitTransaction( 'test' );

    db.commit();
    const diffs = db.data.get( 'diffs' );

    assert.equal( diffs.get( 0 )._type[1], 'author' );
    assert.equal( diffs.get( 0 ).id[1], newAuthor.id );
    assert.equal( diffs.get( 1 )._type[1], 'book' );
    assert.equal( diffs.get( 1 ).id[1], 1 );
    assert.equal( diffs.get( 1 ).title[1], 'Change title' );
    assert.equal( diffs.get( 2 )._type[1], 'book' );
    assert.equal( diffs.get( 2 ).id[1], 1 );
    assert.equal( diffs.get( 2 ).author[1].size, 1 );

    assert( db.data.get( 'head' ).equals( db.data.get( 'tail' ) ) );
  });
});
