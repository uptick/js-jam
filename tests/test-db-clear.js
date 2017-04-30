require( 'isomorphic-fetch' )
console.debug = () => {}
var jsdom = require( 'jsdom-global' )()  // must come first
var assert = require( 'chai' ).assert

import DB from '../src/db'
import {schema, getMovieData, getExtraMovieData} from './movie-fixture'

describe( 'clear', function() {

  it( 'erases objects', function() {

    // Prepare database.
    let db = schema.db()
    db.loadJsonApi( getMovieData() )
    db.loadJsonApi( getExtraMovieData() )
    let trans = db.startTransaction( 'test' )

    // Clear the database.
    db.clear()

    assert.deepEqual(
      db.data.get( 'head' ).toJS(),
      {},
      'failed to erase head'
    )

    assert.deepEqual(
      db.data.get( 'tail' ).toJS(),
      {},
      'failed to erase tail'
    )
  })

  it( 'keeps outgoing objects', function() {

    // Prepare database.
    let db = schema.db()
    db.loadJsonApi( getMovieData() )
    db.loadJsonApi( getExtraMovieData() )
    let trans = db.startTransaction( 'test' )

    // Modify a movie.
    let obj = trans.getInstance( 'movie', 1 )
    obj.title = 'Rocky 2'
    obj.save()
    db.saveTransaction( trans )

    // Commit the transaction, then commit the local changes to
    // create a diff.
    db.commitTransaction( 'test' )
    db.commit()

    assert.equal(
      db.data.get( 'diffs' ).toJS()[0].title[1],
      'Rocky 2',
      'failed to create initial diff'
    )

    // Clear the database.
    db.clear()

    assert.equal(
      db.get( 'movie', 2 ),
      undefined,
      'failed to erase object'
    )

    assert.deepEqual(
      db.get( 'movie', 1 ).toJS(),
      {
        _type: 'movie',
        actors: [
          {
            _type: 'person',
            id: 1
          },
          {
            _type: 'person',
            id: 2
          }
        ],
        director: {
          _type: 'person',
          id: 3
        },
        duration: '58',
        id: 1,
        producer: {
          _type: 'company',
          id: 1
        },
        tags: [
          {
            _type: 'tag',
            id: 1
          },
          {
            _type: 'tag',
            id: 2
          }
        ],
        title: 'Rocky 2'
      },
      'failed to keep outgoing data'
    )
  })
})
