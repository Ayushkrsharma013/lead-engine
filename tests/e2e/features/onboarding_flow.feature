Feature: Full Onboarding Flow
  As a prospect who books a meeting
  I want to complete the full onboarding and lead generation flow
  So that I can access my client portal with generated leads

  Background:
    Given the test environment is ready
    And the mock payment server is running on port 3456

  @happy-path @e2e
  Scenario: Prospect books meeting, completes onboarding, receives leads
    # Step 1: Book a meeting on the public booking page
    Given I am on the public booking page
    When I fill in my name as "<name>"
    And I fill in my email as "<email>"
    And I enter my company as "<company>"
    And I select a future date and time slot
    And I click "Book Meeting"
    Then I should see a confirmation message
    And an appointment should exist in the database for "<email>"

    # Step 2: Admin marks appointment as Won and extracts onboarding token
    Given I am logged in as super admin
    When I navigate to the admin appointments page
    And I find the appointment for "<email>"
    And I mark the appointment status as "Won"
    Then the appointment status should be "won" in the database
    And an onboarding token should be generated for "<email>"

    # Step 3: Complete onboarding with ICP and payment
    Given I navigate to the onboarding page using the token
    Then I should see the ICP configuration step
    When I select industry "SaaS"
    And I select company size "11-50"
    And I select seniority "VP / Director"
    And I select country "United States"
    And I click "Continue"
    Then I should proceed to the payment step
    When I enter test card number "4242424242424242"
    And I enter expiry "12/30"
    And I enter CVC "123"
    And I click "Pay"
    Then I should see a payment success message

    # Step 4: Wait for lead generation
    Given the payment has been processed
    When I poll the lead generation status every 5 seconds
    Then the status should become "ready" within 120 seconds

    # Step 5: Verify leads in dashboard
    When I log in to the client portal as "<email>"
    And I navigate to the client dashboard
    Then I should see generated leads in the leads table
    And each lead card should have a watermark
    And the email column should not be visible
    And right-click should be disabled on lead rows

    # Step 6: Verify admin sees the client
    When I log in as super admin
    And I navigate to the admin clients page
    Then I should see "<email>" in the clients list
    And the client metrics should reflect the new subscription

  @cleanup
  Scenario: Clean up test data after test run
    Given the test run is complete
    When I delete all test data for emails matching "*-test.com"
    Then the database should be clean of test records
