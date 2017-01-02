import {take} from 'redux-saga/effects';

/**
 *
 */
export function *eachInline( actionType, saga ) {
  while( true ) {
    const action = yield take( actionType );
    yield saga( action.payload );
  }
}
