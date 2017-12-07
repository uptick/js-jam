import { call, apply, put, take, select } from 'redux-saga/effects'
import { makeId } from '../utils'

// TODO: Need to make this nicer. :(
import { ajax } from 'js-tinyapi'

export function* changePage( action ) {
  switch( action.type ) {
    case 'MODEL_NEXT_PAGE':
      yield nextPage( action )
      break
    case 'MODEL_PREV_PAGE':
      yield prevPage( action )
      break
    case 'MODEL_FIRST_PAGE':
      yield firstPage( action )
      break
    case 'MODEL_LAST_PAGE':
      yield lastPage( action )
      break
  }
}

export function* nextPage( action ) {
  yield handlePage( action, 'next' )
}

export function* prevPage( action ) {
  yield handlePage( action, 'prev' )
}

export function* firstPage( action ) {
  yield handlePage( action, 'first' )
}

export function* lastPage( action ) {
  yield handlePage( action, 'last' )
}

function* handlePage( action, key ) {
  const { schema, viewName, queryName } = action.payload
  console.debug( `Requesting ${key} page in ${viewName}/${queryName}` )

  // Load the view details from the state.
  const state = yield select()
  const view = state.model.views[viewName]
  const { pagination, links } = view.meta[queryName]

  // Before doing any loading, check that the key goes somewhere.
  if( !links[key] ) {
    console.debug( 'No page to change to.' )
    return
  }

  // Now that we know we need to do something, mark a request.
  yield put( {type: 'MODEL_PAGE_REQUEST', payload: {viewName, queryName}} )

  // Load the page's data from the server.
  let jsonData = yield call( ajax, links[key], undefined, 'get' )
  let meta = {}
  let results = []
  if( jsonData !== null ) {

    // Convert to results.
    // TODO: Okay, all of this should be a function.
    results = jsonData.data.map( x => makeId( x.type, x.id ) )

    // Merge in the loaded data and wait for it to be finished.
    // TODO: Maybe make this a function? Looks like it might happen
    //       in a few places.
    jsonData = [jsonData]  // TODO: So ugly.
    yield put( {type: 'MODEL_LOAD_JSON', payload: {schema, jsonData}} )
    yield take(
      action => {
        return (
          action.type == 'MODEL_LOAD_JSON_DONE'
          && action.payload
          && action.payload.jsonData == jsonData
        )
      }
    )
    jsonData = jsonData[0]  // TODO: So ugly.

    // Construct the meta values.
    // TODO: This should also be a function.
    meta = {
      ...(jsonData.meta || {})
    }
    if( jsonData.links ) {
      meta.links = jsonData.links
    }
  }

  yield put( {type: 'MODEL_PAGE_SUCCESS', payload: {viewName, queryName, results, meta}} )
}
