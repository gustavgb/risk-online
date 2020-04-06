import React, { Component } from 'react'
import styled, { keyframes } from 'styled-components'
import card0Img from 'images/card_1.png'
import card1Img from 'images/card_2.png'
import card2Img from 'images/card_3.png'
import { removeDisplayedCard, discardDisplayedCards, pushToLog } from 'api/game'

const Root = styled.div`
  position: absolute;
  z-index: 100;
  background-color: rgba(100, 100, 100, 0.7);
  right: 0;
  bottom: 0;
  top: 0;
  left: 20vw;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr 1fr;
  justify-items: center;
  color: white;
  font-size: 25px;
  user-select: none;
  overflow: hidden;
`

const DiscardZone = styled.div`
  position: absolute;
  z-index: 100;
  width: 20vw;
  bottom: 0;
  top: 0;
  left: 0;
  color: white;
  font-size: 25px;
  user-select: none;
  pointer-events: ${props => props.active ? 'all' : 'none'};
`

const CardContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-self: flex-start;
`

const flyIn = keyframes`
  0% {
    transform: translate3d(50vw, 0, 0);
  }

  100% {
    transform: translate3d(0, 0, 0);
  }
`

const Card = styled.div`
  background-color: #e3e9e7;
  background-image: url(${props => props.bg});
  background-repeat: no-repeat;
  background-size: contain;
  background-position: center;
  height: 10vw;
  width: 6vw;
  animation: ${flyIn} 1s ease-out;
  margin-left: 16px;

  opacity: ${props => props.selected ? '0' : '1'};

  &:first-child {
    margin-left: 0;
  }
`

const Header = styled.div`
  color: white;
  align-self: flex-end;
`

const DiscardButton = styled.button`
  padding: 20px 30px;
  margin: 10px 0;
  width: 100%;
  display: block;
  background-color: red;
  border: 0;
  font-size: 20px;
  color: white;
  cursor: pointer;
`

class DisplayedCards extends Component {
  shouldComponentUpdate (nextProps) {
    return (
      nextProps.displayedCards.userId !== this.props.displayedCards.userId ||
      nextProps.displayedCards.list.length !== this.props.displayedCards.list.length ||
      nextProps.action.type !== this.props.action.type
    )
  }

  getCardBg (card) {
    switch (card) {
      case 0:
        return card0Img
      case 1:
        return card1Img
      case 2:
        return card2Img
      default:
        return ''
    }
  }

  pushToLog (code, content) {
    const { game: { id } } = this.props

    pushToLog(id, code, content)
  }

  onTakeCard (card, index) {
    const { action, displayedCards, user: { uid } } = this.props

    if (action.type !== 'MOVE_DISPLAYED_CARD' && displayedCards.userId === uid) {
      this.props.onChangeAction({
        type: 'MOVE_DISPLAYED_CARD',
        options: {
          type: card.cardType,
          index,
          cardIndex: card.cardIndex
        }
      })
    }
  }

  onCancelCard (type, index) {
    const { action } = this.props

    if (action.type === 'MOVE_DISPLAYED_CARD') {
      this.props.onChangeAction({})
    }
  }

  onReturnCard () {
    const { action, game: { id }, user: { uid, name } } = this.props

    if (action.type === 'MOVE_DISPLAYED_CARD') {
      removeDisplayedCard(id, uid, action.options.cardIndex)
      this.pushToLog(
        'HIDE_CARD',
        {
          user: name,
          type: action.options.type
        }
      )
      this.props.onChangeAction({})
    }
  }

  onDiscardCards () {
    const { game: { id }, user: { uid, name }, displayedCards } = this.props
    if (window.confirm('Vil du smide disse kort?')) {
      discardDisplayedCards(id, uid, displayedCards.list)
      this.pushToLog(
        'DISCARD_CARDS',
        {
          user: name,
          cards: displayedCards.list.map(cards => cards.cardType)
        }
      )
    }
  }

  render () {
    const { displayedCards, users, user: { uid }, action } = this.props

    const user = users.find(u => u.id === displayedCards.userId)

    return (
      <>
        <DiscardZone active={action.type === 'MOVE_DISPLAYED_CARD'} onMouseUp={() => this.onReturnCard()} />
        <Root onMouseUp={this.onCancelCard.bind(this)}>
          <Header>
            <h2>{uid === displayedCards.userId ? 'Du viser dine kort' : `${user.name} viser sine kort`}</h2>
            {uid === displayedCards.userId && (
              <DiscardButton onClick={this.onDiscardCards.bind(this)}>Smid disse kort</DiscardButton>
            )}
          </Header>
          <CardContainer>
            {displayedCards.list.map((card, index) => (
              <Card
                bg={this.getCardBg(card.cardType)}
                key={card.cardIndex}
                onMouseDown={() => this.onTakeCard(card, index)}
                selected={action.type === 'MOVE_DISPLAYED_CARD' && action.options.index === index}
              />
            ))}
          </CardContainer>
        </Root>
      </>
    )
  }
}

export default DisplayedCards
