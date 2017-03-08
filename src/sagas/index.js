import {takeLatest} from 'redux-saga';
import {call, apply, put, take, select} from 'redux-saga/effects';
import {OrderedSet} from 'immutable';

import {makeId, getDiffId} from '../utils';
import DB from '../db';
import {eachInline} from './utils';

function* loadModelView( action ) {
  try {
    const {schema, name, query, props} = action.payload;
    yield put( {type: 'MODEL_LOAD_VIEW_REQUEST', payload: {name}} );

    const state = yield select();
    let db = schema.db( state.model.db );

    // A place to put the IDs of our loaded objects.
    let results = {};

    // A place to hold the JSON responses to be loaded.
    let jsonData = [];
    
    // Process each named query. We want to load the data, cache it
    // in results, then update the store immediately.
    for( const name of Object.keys( query ) ) {
      console.debug( `loadModelView: Looking up ${name}.` );
      const data = yield call( query[name], props );
      if( data !== null )
        jsonData.push( data );
      if( data ) {
        if( Array.isArray( data.data ) )
          results[name] = data.data.map( x => makeId( x.type, x.id ) );
        else
          results[name] = makeId( data.data.type, data.data.id );
      }
      else
        results[name] = null;
    }

    // Flag this view as ready. We also want to supply a list of IDs
    // of each type of model loaded.
    yield put( {type: 'MODEL_LOAD_JSON', payload: {schema, jsonData}} );
    yield put( {type: 'MODEL_LOAD_VIEW_SUCCESS', payload: {name, results}} );
  }
  catch( e ) {
    console.error( e );
    yield put( {type: 'MODEL_LOAD_VIEW_FAILURE', errors: e.message} );
  }
}

/* function reIdDiff( db, diff, id, newId ) {
 *   const fromId = db.getId( diff._type[0], id );
 *   const toId = db.getId( diff._type[0], newId );
 *   console.log( 'fromId: ', fromId.toJS() );
 *   console.log( 'toId: ', toId.toJS() );
 *   console.log( 'diff: ', diff );
 *   let newDiff = {
 *     ...diff
 *   };
 *   if( diff.id[0] == id ) {
 *     newDiff.id[0] = newId;
 *   }
 *   if( diff.id[1] == id ) {
 *     newDiff.id[1] = newId;
 *   }
 *   const relModel = db.getModel( getDiffId( diff )._type );
 *   for( const field of relModel.iterForeignKeys() ) {
 *     if( diff[field] ) {
 *       newDiff[field] = [diff[field][0], diff[field][1]];
 *       if( diff[field][0] && diff[field][0].equals( fromId ) ) {
 *         newDiff[field][0] = toId;
 *       }
 *       if( diff[field][1] && diff[field][1].equals( fromId ) ) {
 *         newDiff[field][1] = toId;
 *       }
 *     }
 *   }
 *   for( const field of relModel.iterManyToMany() ) {
 *     if( diff[field] ) {
 *       newDiff[field] = [diff[field][0], diff[field][1]];
 *       if( newDiff[field][0] && newDiff[field][0].has( fromId ) ) {
 *         newDiff[field][0] = newDiff[field][0].delete( fromId ).add( toId );
 *       }
 *       console.log( newDiff[field][1].toJS() );
 *       console.log( fromId.toJS() );
 *       console.log( newDiff[field][1].has( fromId ) );
 *       if( newDiff[field][1] && newDiff[field][1].has( fromId ) ) {
 *         newDiff[field][1] = newDiff[field][1].delete( fromId ).add( toId );
 *       }
 *     }
 *   }
 *   return newDiff;
 * }*/

/**
 * Synchronise the current DB against the server.
 */
function* sync( payload ) {
  console.debug( 'Model: Sync.' );
  const {schema} = payload;
  try {
    yield put( {type: 'MODEL_SYNC_REQUEST'} );
    yield put( {type: 'MODEL_COMMIT', payload: {schema}} );
    while( 1 ) {
      let state = yield select();
      let db = schema.db( state.model.db );
      let response = yield call( [db, db.commitDiff] );
      if( !response )
        break;
      yield put( {type: 'MODEL_POST_COMMIT_DIFF', payload: {response, schema}} );
    }
    yield put( {type: 'MODEL_SYNC_SUCCESS'} );
  }
  catch( e ) {
    console.error( e );
    yield put( {type: 'MODEL_SYNC_FAILURE', errors: e.message} );
  }
}

export default function* modelSaga() {
  yield [
    takeLatest( 'MODEL_LOAD_VIEW', loadModelView ),
    eachInline( 'MODEL_SYNC', sync )
  ];
}
