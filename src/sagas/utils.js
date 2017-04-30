import {take, actionChannel} from 'redux-saga/effects'

/**
 *
 */
export function *eachInline( actionType, saga ) {
  const chan = yield actionChannel( actionType )
  while( true ) {
    const action = yield take( chan )
    yield saga( action )
  }
}
