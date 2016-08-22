Feature: Manage Sources

    Scenario: manage_publish_options.feature 1. Publish options - default is off
        Using selenium
        Given I am instructor_one in Sample Course

        When I open the manage menu
        Then there is a "Settings" link
        When I click the "Settings" link
        Then I am at the Course Settings page

        Then publish to world is disabled

        Given publish to world is enabled

        When I open the manage menu
        Then there is a "Settings" link
        When I click the "Settings" link
        Then I am at the Course Settings page

        Then publish to world is enabled

        Given publish to world is disabled

        When I open the manage menu
        Then there is a "Settings" link
        When I click the "Settings" link
        Then I am at the Course Settings page

        Then publish to world is disabled

        Finished using Selenium
