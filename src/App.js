import React, { Component } from 'react'

import styled from 'styled-components'

import { auth } from 'api'
import Login from 'Login'
import Browse from 'Browse'
import Board from 'Board'
import { joinGame } from 'api/browse'
import { withRouter, Route, Switch } from 'react-router-dom'

const Root = styled.div`
`

class App extends Component {
  constructor (props) {
    super(props)

    this.state = {
      user: null,
      loaded: false
    }
  }

  componentDidMount () {
    const self = this

    auth.onAuthStateChanged(function (user) {
      self.setState({
        user,
        loaded: true
      })
    })
  }

  onJoinGame (gameId) {
    const { user } = this.state
    const { history } = this.props

    joinGame(user, gameId)

    history.push(`/${gameId}`)
  }

  render () {
    const {
      loaded,
      user
    } = this.state

    return (
      <Root>
        {!loaded && 'Loading...'}
        {loaded && !user && (
          <Login />
        )}
        {loaded && user && (
          <Switch>
            <Route
              path='/:gameId'
              render={({ match: { params } }) => (
                <Board joinedGame={params.gameId} user={user} />
              )}
            />
            <Route
              path='/'
              render={() => (
                <Browse user={user} onJoinGame={this.onJoinGame.bind(this)} />
              )}
            />
          </Switch>
        )}
      </Root>
    )
  }
}

export default withRouter(App)
