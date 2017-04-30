import React, {Component} from 'react'
import {connect} from 'react-redux'

import Spinner from './spinner'

class SyncStatus extends Component {
  render() {
    const {sync} = this.props
    if( sync ) {
      return (
        <div style={{position: 'fixed', top: '0', right: '0', background: 'rgba(0,0,0,0.4)', padding: '10px', margin: '10px', borderRadius: '5px'}}>
          <Spinner color="#fff" />
        </div>
      )
    }
    else {
      return null
    }
  }
}

SyncStatus = connect(
  state => {
    const {model={}} = state
    const {sync} = model
    return {
      sync
    }
  }
)(
  SyncStatus
)

export default SyncStatus
