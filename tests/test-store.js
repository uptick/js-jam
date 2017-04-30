require( 'isomorphic-fetch' )
console.debug = () => {}
var jsdom = require( 'jsdom-global' )()  // must come first
var assert = require( 'chai' ).assert

import {call, put, select} from 'redux-saga/effects'

import DB from '../src/db'
import {
  mutationSerializer,
  commitTransaction,
  saveTransaction,
  mutate
} from '../src/sagas/'
import {schema, getMovieData} from './movie-fixture'

describe( 'store', function() {

  it( 'save transaction', function() {
    let db = schema.db()
    db.loadJsonApi( getMovieData() )

    db.startTransaction( 'test' )
    let trans = db.getTransaction( 'test' )
    let obj = trans.get( 'movie', 1 )
    trans.update( obj.set( 'title', 'Rocky 2' ) )

    assert.equal(
      db.getTransaction( 'test' ).get( 'movie', 1 ).title, 'Rocky',
      'original DB must not have new value'
    )

    let action = {
      type: 'MODEL_SAVE_TRANSACTION',
      payload: {
        schema,
        db: trans
      }
    }
    let gen = mutationSerializer( action )
    assert.deepEqual( gen.next().value, call( saveTransaction, action.payload ) )
    assert.equal( gen.next().done, true )

    gen = saveTransaction( action.payload )
    let saveEffect = gen.next().value
    assert.notEqual( saveEffect.CALL, undefined )
    assert.equal( gen.next().done, true )

    let called = false
    gen = mutate( action.payload.schema, _db => {
      called = true
      saveEffect.CALL.args[1]( _db )
    })
    assert.deepEqual( gen.next().value, select() )
    let putEffect = gen.next( {model: {db: db.data}} ).value
    assert.deepEqual( putEffect.PUT.action.type, 'MODEL_SET_DB_DATA' )
    assert.equal( gen.next().done, true )
    assert.equal( called, true )

    db.data = putEffect.PUT.action.payload
    assert.equal(
      db.getTransaction( 'test' ).get( 'movie', 1 ).title, 'Rocky 2',
      'original DB must have new value'
    )
  })
})
