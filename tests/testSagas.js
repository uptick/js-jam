import 'isomorphic-fetch'
import {expect} from 'code'
import sinon from 'sinon'
import {put, call, take, select} from 'redux-saga/effects'

import {sync} from '../src/sagas/index'

import './silence'
import * as fixture from './fixture'

describe('Synchronisation', function() {
  let db = fixture.schema.db()
  let movie = db.create2('movie', {})
  /* let person = db.create2('person', {
   *   owns: [movie],
   *   favorite: movie
   * }) */
  db.commit()

  let createStub
  let addStub

  beforeEach(function() {
    createStub = sinon.stub().resolves({
      data: {
        type: 'movie',
        id: 1001
      }
    })
    db.schema.models.get('movie').ops.create = createStub
    addStub = sinon.stub()
    db.schema.models.get('movie').ops.ownsAdd = addStub
  })

  // TODO
  it('does something', async function() {
    const gen = sync({payload: {schema: db.schema}})
    expect(gen.next().value).to.equal(put({type: 'MODEL_SYNC_REQUEST'}))
    expect(gen.next().value).to.equal(select())
    expect(gen.next({model: {db: db.data}}).value).to.equal(call([db, db.commitDiff]))

    let response = await db.commitDiff()
    expect(gen.next(response).value).to.equal(put({type: 'MODEL_POST_COMMIT_DIFF', payload: {schema: db.schema, response}}))
    expect(gen.next().value).to.equal(take('MODEL_POST_COMMIT_DIFF_DONE'))
    db.postCommitDiff(response)

    createStub.returns('done')
    response = await db.commitDiff()
    expect(gen.next().value).to.equal(select())
    expect(gen.next({model: {db: db.data}}).value).to.equal(call([db, db.commitDiff]))

    expect(gen.next(response).value).to.equal(put({type: 'MODEL_SYNC_SUCCESS'}))
  })

})
