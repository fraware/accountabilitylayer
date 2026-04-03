describe('Dashboard E2E Test', () => {
  it('should allow user to login, view dashboard, filter logs, and view log details', () => {
    cy.visit('/login');

    cy.get('[data-testid="login-username"]').type('auditor1');
    cy.get('[data-testid="login-password"]').type('password');
    cy.contains('button', 'Login').click();

    cy.contains('Accountability Layer Dashboard').should('be.visible');
    cy.contains('Role:').should('contain', 'auditor');

    cy.get('[data-testid="filter-agent"]').type('agent_test');
    cy.contains('button', 'Apply Filters').click();

    cy.get('.log-item').first().click();
    cy.contains('Log Detail - Step').should('be.visible');

    cy.contains('button', 'Close').click();
  });
});
