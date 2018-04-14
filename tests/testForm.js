import 'isomorphic-fetch'
import 'jsdom-global/register'
import React from 'react'
import {expect} from 'code'
import {configure} from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {mountWithStore} from 'enzyme-redux'
import {createMockStore} from 'redux-test-utils'

import withForm from '../src/components/form/withForm'
import Instance from '../src/instance'
import {isRecord} from '../src/utils'

import './silence'
import * as fixture from './fixture'

configure({adapter: new Adapter()})

describe('A form component', function() {
  const initialStore = {
    model: {}
  }

  @withForm({type: 'movie'})
  class Component extends React.Component {
    render() {
      return null
    }
  }

  it('moves a saved item from local diffs into outgoing diffs when reset', function() {
    let com = mountWithStore(
      <Component db={fixture.db} />,
      createMockStore(initialStore)
    )

    // New movie has been created.
    {
      let db = com.state().db
      let instId = com.state().instanceId
      expect(instId).to.satisfy(x => isRecord(x))
      expect(db.get(instId)).to.satisfy(x => isRecord(x))
    }

    // Offset set to 0.
    expect(com.state().offset).to.equal(0)

    // Updates correctly multiple time consecutively.
    com.children().props().mutateForm(() => {
      let db = com.state().db.copy()
      db.update(com.state().instanceId, {title: 't'})
      return db
    })
    expect(com.state().db.get(com.state().instanceId).title).to.equal('t')
    com.children().props().mutateForm(() => {
      let db = com.state().db.copy()
      db.update(com.state().instanceId, {title: 'te'})
      return db
    })
    expect(com.state().db.get(com.state().instanceId).title).to.equal('te')
    com.children().props().mutateForm(() => {
      let db = com.state().db.copy()
      db.update(com.state().instanceId, {title: 'tes'})
      return db
    })
    expect(com.state().db.get(com.state().instanceId).title).to.equal('tes')
    com.children().props().mutateForm(() => {
      let db = com.state().db.copy()
      db.update(com.state().instanceId, {title: 'test'})
      return db
    })
    expect(com.state().db.get(com.state().instanceId).title).to.equal('test')

    // Saving database is okay. This simulates the period after
    // saveDB and before commit is called. There will be a set
    // of local diffs.
    expect(com.state().db.getOutgoingDiffs().size).to.equal(0)
    expect(com.props().db.getOutgoingDiffs().size).to.equal(0)
    expect(com.state().db.getLocalDiffs().size).to.equal(5)
    expect(com.props().db.getLocalDiffs().size).to.equal(0)
    {
      let db = com.state().db.copy()
      com.children().props().resetForm()
      com.setProps({db})
    }
    expect(com.state().db.getOutgoingDiffs().size).to.equal(0)
    expect(com.props().db.getOutgoingDiffs().size).to.equal(0)
    expect(com.state().db.getLocalDiffs().size).to.equal(6)
    expect(com.props().db.getLocalDiffs().size).to.equal(5)

    // Committing is okay. This will throw an error if the rebasing
    // hasn't gone as planned.
    {
      let db = com.props().db.copy()
      db.commit()
      com.setProps({db})
    }
  })

})
