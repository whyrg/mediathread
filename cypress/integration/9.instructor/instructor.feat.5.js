Cypress.on('uncaught:exception', (err, runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    return false;
});

describe('Instructor Feat: Student Contributions', () => {
    before(() => {
        cy.login('instructor_one', 'test');
        cy.visit('/course/1/');
    });

    it('should test assignment response as an instructor', () => {
        cy.get('a[href="/course/1/dashboard/settings/"]').click();
        cy.title().should('contain', 'Course Settings');
        cy.get('a[href="/reports/class_summary/"]').click();
        cy.contains('Report: Course Member Contributions');
    });
});