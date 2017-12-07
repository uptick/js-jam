require( 'isomorphic-fetch' )
console.debug = () => {}
var jsdom = require( 'jsdom-global' )()  // must come first
var assert = require( 'chai' ).assert

import DB from '../src/db'
import {schema, getMovieData, getExtraMovieData} from './movie-fixture'

describe( 'load with outgoing', function() {

  it( 'load unrelated data', function() {

    // Prepare database.
    let db = schema.db()
    db.loadJsonApi( getMovieData() )
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

    // Load new data.
    db.loadJsonApi( getExtraMovieData() )

    assert.deepEqual(
      db.get( 'movie', 2 ).toJS(),
      {
        _type: 'movie',
        id: 2,
        title: 'Critters',
        actors: [],
        tags: [],
        duration: '112',
        director: undefined,
        producer: undefined
      },
      'failed to load new data'
    )

    assert.equal(
      db.get( 'movie', 1 ).title,
      'Rocky 2',
      'failed to maintain modified data'
    )

    assert.equal(
      db.data.get( 'diffs' ).toJS()[0].title[1],
      'Rocky 2',
      'failed to maintain outgoing diff'
    )

    // Try a recommit, it should not produce anything.
    db.commit()

    assert.equal(
      db.data.get( 'diffs' ).toJS().length,
      1,
      'created a spurious diff'
    )
  })

  it( 'keep local changes', function() {

    // Prepare database.
    let db = schema.db()
    db.loadJsonApi( getMovieData() )
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

    // Modify another movie but don't commit.
    trans = db.startTransaction( 'test2' )
    obj = trans.getInstance( 'movie', 1 )
    obj.title = 'Rocky 3'
    obj.save()
    db.saveTransaction( trans )
    db.commitTransaction( 'test2' )

    assert.equal(
      db.data.get( 'diffs' ).toJS()[0].title[1],
      'Rocky 2',
      'failed to create initial diff'
    )

    // Load new data.
    db.loadJsonApi( getExtraMovieData() )

    assert.deepEqual(
      db.get( 'movie', 2 ).toJS(),
      {
        _type: 'movie',
        id: 2,
        title: 'Critters',
        actors: [],
        tags: [],
        duration: '112',
        director: undefined,
        producer: undefined
      },
      'failed to load new data'
    )

    assert.equal(
      db.get( 'movie', 1 ).title,
      'Rocky 3',
      'failed to maintain modified data'
    )
    
    assert.equal(
      db.data.get( 'diffs' ).toJS()[0].title[1],
      'Rocky 2',
      'failed to maintain outgoing diff'
    )

    // New commit, should add the new change.
    db.commit()

    assert.equal(
      db.data.get( 'diffs' ).toJS()[1].title[1],
      'Rocky 3',
      'failed to create new diff'
    )
  })
})
