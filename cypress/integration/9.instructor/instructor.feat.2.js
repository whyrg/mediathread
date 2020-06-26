describe('Instructor Feat: Course Activity', () => {

    beforeEach(() => {
        cy.login('instructor_one', 'test');
        cy.visit('/course/1/');
    });

    it('should go to course Activity', () => {
        cy.get('a[href="/course/1/dashboard/settings/"]').click();
        cy.title().should('contain', 'Course Settings');
        cy.get('a[href="/reports/class_activity/"]').should('exist');
        cy.get('a[href="/reports/class_activity/"]').click();
        cy.contains('Report: Course Activity').should('exist');
        cy.contains('MAAP Award Reception').should('have.attr', 'href');
        cy.contains('Sample Assignment Response').should('have.attr', 'href');
        cy.contains("The Armory - Home to CCNMTL's CUMC Office")
            .should('have.attr', 'href');
        cy.contains('Mediathread: Introduction').should('have.attr', 'href');
    });
});