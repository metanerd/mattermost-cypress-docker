// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../fixtures/timeouts';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @multi_team_and_dm

describe('Send a DM', () => {
    let userA; // Member of team A and B
    let userB; // Member of team A and B
    let userC; // Member of team A
    let testChannel;
    let teamA;
    let teamB;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            userA = user;
            teamA = team;
            testChannel = channel;

            cy.apiCreateUser().then(({user: otherUser}) => {
                userB = otherUser;
                return cy.apiAddUserToTeam(teamA.id, userB.id);
            }).then(() => {
                return cy.apiCreateUser();
            }).then(({user: otherUser}) => {
                userC = otherUser;
                return cy.apiAddUserToTeam(teamA.id, userC.id);
            }).then(() => {
                return cy.apiCreateTeam('team', 'Team');
            }).then(({team: otherTeam}) => {
                teamB = otherTeam;
                return cy.apiAddUserToTeam(teamB.id, userA.id);
            }).then(() => {
                return cy.apiAddUserToTeam(teamB.id, userB.id);
            });
        });
    });

    beforeEach(() => {
        // # Log in to Team A with an account that has joined multiple teams.
        cy.apiLogin(userA);

        // # On an account on two teams, view Team A
        cy.visitAndWait(`/${teamA.name}/channels/town-square`);
    });

    it('MM-T433 Switch teams', () => {
        // # Open several DM channels, including accounts that are not on Team B.
        cy.apiCreateDirectChannel([userA.id, userB.id]).wait(TIMEOUTS.ONE_SEC).then(() => {
            cy.visitAndWait(`/${teamA.name}/channels/${userA.id}__${userB.id}`).wait(TIMEOUTS.FIVE_SEC);
            cy.postMessage(':)');
            return cy.apiCreateDirectChannel([userA.id, userC.id]).wait(TIMEOUTS.ONE_SEC);
        }).then(() => {
            cy.visitAndWait(`/${teamA.name}/channels/${userA.id}__${userC.id}`).wait(TIMEOUTS.FIVE_SEC);
            cy.postMessage(':(');
        });

        // # Click Team B in the team sidebar.
        cy.get(`#${teamB.name}TeamButton`, {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();

        // * Channel list in the LHS is scrolled to the top.
        cy.get('#publicChannelList').get('.active').should('contain', 'Town Square');

        // * Verify team display name changes correctly.
        cy.get('#headerTeamName', {timeout: TIMEOUTS.ONE_MIN}).should('contain', teamB.display_name);

        // * DM Channel list should be the same on both teams with no missing names.
        cy.get('#directChannelList').findByText(`${userB.username}`).should('be.visible');
        cy.get('#directChannelList').findByText(`${userC.username}`).should('be.visible');

        // # Post a message in Town Square in Team B
        cy.postMessage('Hello World');

        // * Verify posting a message works properly.
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('be.visible').and('have.text', 'Hello World');
        });

        // # Click Team A in the team sidebar.
        cy.get(`#${teamA.name}TeamButton`, {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();

        // * Verify there is no cross contamination between teams.
        cy.get('#sidebarItem_town-square').should('not.have.class', 'unread-title');

        // * DM Channel list should be the same on both teams with no missing names.
        cy.get('#directChannelList').findByText(`${userB.username}`).should('be.visible');
        cy.get('#directChannelList').findByText(`${userC.username}`).should('be.visible');

        // * Channel viewed on a team before switching should be the one that displays after switching back (Town Square does not briefly show).
        cy.url().should('include', `/${teamA.name}/messages/@${userC.username}`);
    });

    it('MM-T437 Multi-team mentions', () => {
        // # Have another user also on those two teams post two at-mentions for you on Team B
        cy.apiLogin(userB);

        cy.visitAndWait(`/${teamB.name}/channels/town-square`).wait(TIMEOUTS.FIVE_SEC);
        cy.postMessage(`@${userA.username}`);
        cy.postMessage(`@${userA.username}`);
        cy.apiLogout();

        cy.apiLogin(userA);
        cy.visitAndWait(`/${teamA.name}/channels/town-square`).wait(TIMEOUTS.FIVE_SEC);

        // * Observe a mention badge with "2" on Team B on your team sidebar
        cy.get(`#${teamB.name}TeamButton`).should('be.visible').within(() => {
            cy.get('.badge').contains('2');
        });
    });

    it('MM-T438 Multi-team unreads', () => {
        // # Go to team B, and make sure all mentions are read
        cy.visitAndWait(`/${teamB.name}/channels/town-square`).wait(TIMEOUTS.FIVE_SEC);
        cy.visitAndWait(`/${teamA.name}/channels/${testChannel.name}`).wait(TIMEOUTS.FIVE_SEC);

        // * No dot appears for you on Team B since there are no more mentions
        cy.get(`#${teamB.name}TeamButton`).should('be.visible').within(() => {
            cy.get('.badge').should('not.exist');
        });

        // # Have the other user switch to Team A and post (a message, not a mention) in a channel you're a member of
        cy.apiLogin(userB);

        cy.visitAndWait(`/${teamA.name}/channels/town-square`).wait(TIMEOUTS.FIVE_SEC);
        cy.postMessage('Hey all');
        cy.apiLogout();

        // * Dot appears, with no number (just unread, not a mention)
        cy.apiLogin(userA);
        cy.visitAndWait(`/${teamB.name}/channels/town-square`).wait(TIMEOUTS.FIVE_SEC);
        cy.get(`#${teamA.name}TeamButton`).parent('.unread').should('be.visible');
        cy.get(`#${teamA.name}TeamButton`).should('be.visible').within(() => {
            cy.get('.badge').should('not.exist');
        });
    });
});
