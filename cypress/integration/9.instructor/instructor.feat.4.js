Cypress.on('uncaught:exception', (err, runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    return false;
});

describe('Instructor Feat: Test Assignment Responses', () => {
    beforeEach(() => {
        cy.login('instructor_one', 'test');
        cy.visit('/course/1/');
    });

    it('should test assignment response as an instructor', () => {

        cy.get('a[href="/course/1/dashboard/settings/"]').click();
        cy.title().should('contain', 'Course Settings');
        cy.get('a[href="/reports/class_assignments/"]').click();
        cy.contains('1 / 3').should('have.attr', 'href');
        cy.contains('1 / 3').click();
        cy.contains('Assignment Report: Sample Assignment').should('exist');
        cy.contains('Student One').should('exist');
        cy.contains('Sample Assignment Response').should('have.attr', 'href');
        cy.contains('Submitted to Instructor').should('exist');
        cy.contains('No').should('exist');

        cy.contains('Sample Assignment Response').click();
        cy.title().should('contain', 'Sample Assignment Response');
        cy.get('td.panel-container.open.composition').should('exist');
        cy.title().should('contain', 'Sample Assignment Response');
    });
});