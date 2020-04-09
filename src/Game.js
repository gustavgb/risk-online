import React, { Component } from 'react'
import styled from 'styled-components'
import cardBackImg from 'images/card_back.png'
import { streamState, joinGame, connectToPresence } from 'api/game'
import SidebarContainer from 'Sidebar'
import BoardContainer from 'Board'
import DisplayedCards from 'DisplayedCards'
import EventLog from 'EventLog'
import LandingPrompt from 'Landing'
import Card from 'Card'
import { checkCode } from 'api/browse'
import CenteredMessage from 'CenteredMessage'
import { Link } from 'react-router-dom'

const Root = styled.div`
  width: 100vw;
  height: 100vh;

  &::after {
    content: "";
    clear: both;
    display: table;
  }
`

const Content = styled.div`
  float: left;
  position: relative;
  width: calc(100% - 20vw);
  height: 100%;
  overflow: hidden;
`

const ActionContainer = styled.div.attrs(props => ({
  style: {
    left: props.x,
    top: props.y
  }
}))`
  position: absolute;
  z-index: 1000;
  pointer-events: none;

  & > * {
    max-height: 10rem;
    max-width: 10rem;
  }
`

const ArmyMarker = styled.div`
  width: 2.5vw;
  height: 2.5vw;
  border-radius: 50%;
  border: 2px solid black;
  color: ${props => props.theme.invertColor(props.color)};
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
  background-color: ${props => props.color};
`

const DropZoneBlocker = styled.div`
  position: absolute;
  z-index: 100;
  right: 0;
  bottom: 0;
  top: 0;
  left: 0;
  color: white;
  font-size: 25px;
  user-select: none;
  pointer-events: ${props => props.active ? 'all' : 'none'};
`

class GameContainer extends Component {
  constructor (props) {
    super(props)

    this.state = {
      game: null,
      hand: null,
      users: null,
      mouseX: 0,
      mouseY: 0,
      action: {},
      invalidCode: false
    }

    this.boardEl = React.createRef()

    this.streamState = null

    this._onMouseMove = this.onMouseMove.bind(this)
  }

  componentDidMount () {
    const { user, joinedGame } = this.props

    console.log(joinedGame)

    checkCode(joinedGame)
      .then(() => joinGame(user, joinedGame))
      .then(() => {
        this.connectToPresence = connectToPresence(joinedGame, user.uid)

        this.streamState = streamState(user, joinedGame).subscribe((state) => {
          this.setState(state)
        })
      })
      .catch(() => this.setState({
        invalidCode: true
      }))

    window.addEventListener('mousemove', this._onMouseMove)
  }

  componentWillUnmount () {
    if (this.streamState) {
      this.streamState.unsubscribe()
    }

    if (this.connectToPresence) {
      this.connectToPresence()
    }

    window.removeEventListener('mousemove', this._onMouseMove)
  }

  onMouseMove (e) {
    if (this.state.action) {
      this.setState({
        mouseX: e.clientX,
        mouseY: e.clientY
      })
    }
  }

  onChangeAction (action) {
    this.setState({
      action
    })
  }

  renderAction () {
    const {
      mouseX,
      mouseY,
      action
    } = this.state

    switch (action.type) {
      case 'PLACE_ARMY':
        return (
          <ActionContainer
            x={mouseX}
            y={mouseY}
          >
            <ArmyMarker color={action.options.color}>
              {action.options.amount}
            </ArmyMarker>
          </ActionContainer>
        )
      case 'MOVE_CARD':
      case 'MOVE_DISPLAYED_CARD':
        return (
          <ActionContainer
            x={mouseX}
            y={mouseY}
          >
            {(action.options.index === 'mission' || action.options.cardIndex === 'mission')
              ? (
                <Card landscape width='154px' label='Missionskort' />
              )
              : (
                <Card type={action.options.type} width='100px' />
              )}
          </ActionContainer>
        )
      case 'TAKE_CARD':
        return (
          <ActionContainer
            x={mouseX}
            y={mouseY}
          >
            <img src={cardBackImg} alt='Card Action' />
          </ActionContainer>
        )
      case 'MOVE_ARMY':
        return (
          <ActionContainer
            x={mouseX}
            y={mouseY}
          >
            <ArmyMarker color={action.options.color}>
              {action.options.amount}
            </ArmyMarker>
          </ActionContainer>
        )
      default:
        return null
    }
  }

  render () {
    const {
      action,
      users,
      game,
      hand,
      invalidCode
    } = this.state
    const {
      user: {
        uid
      }
    } = this.props

    if (invalidCode) {
      return (
        <CenteredMessage>
          <p>Dette spil findes desværre ikke...</p>
          <Link to='/'>
            &larr;
            Tilbage til forsiden
          </Link>
        </CenteredMessage>
      )
    }

    if (!game || !users || !hand) {
      return <CenteredMessage>Loading...</CenteredMessage>
    }

    const ownUser = {
      ...users.find(user => user.id === uid),
      uid
    }

    if (!game.colors[ownUser.uid]) {
      return (
        <LandingPrompt
          user={ownUser}
          game={game}
          users={users}
        />
      )
    }

    return (
      <Root>
        <DropZoneBlocker active={action.type === 'MOVE_ARMY'} onContextMenu={e => e.preventDefault()} />
        {game.displayedCards.list.length > 0 && (
          <DisplayedCards
            displayedCards={game.displayedCards}
            onChangeAction={this.onChangeAction.bind(this)}
            users={users}
            game={game}
            user={ownUser}
            action={action}
          />
        )}
        <SidebarContainer
          action={action}
          user={ownUser}
          users={users}
          hand={hand}
          game={game}
          onChangeAction={this.onChangeAction.bind(this)}
        />
        <Content>
          <BoardContainer
            action={action}
            user={ownUser}
            users={users}
            hand={hand}
            game={game}
            onChangeAction={this.onChangeAction.bind(this)}
          />
          <EventLog events={game.events} />
        </Content>
        {this.renderAction()}
      </Root>
    )
  }
}

export default GameContainer
