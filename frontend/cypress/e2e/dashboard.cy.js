describe('Dashboard E2E Test', () => {
    it('should allow user to login, view dashboard, filter logs, and view log details', () => {
      // Visit the login page.
      cy.visit('/');
  
      // Fill in login form and submit.
      cy.get('input[label="Username"]').type('auditor1');
      cy.get('input[label="Password"]').type('password');
      cy.contains('Login').click();
  
      // Verify dashboard loads.
      cy.contains('Accountability Layer Dashboard').should('be.visible');
      cy.contains('Role:').should('contain', 'auditor');
  
      // Use filter component.
      cy.get('input[label="Agent"]').type('agent_test');
      cy.contains('Apply Filters').click();
  
      // Click on a log item to view details.
      cy.get('.log-item').first().click();
      cy.contains('Log Detail - Step').should('be.visible');
  
      // Close the modal.
      cy.contains('Close').click();
    });
  });
  