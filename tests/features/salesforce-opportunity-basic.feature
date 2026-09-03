@smoke @salesforce @opportunity
Feature: Salesforce opportunity basic flow
  Scenario: Login and open New Opportunity from related tab
    Given Login to salesforce
    When Click global search and enter the account name as "Scottsdale gun club"
    And Click Related tab
    Then Click New button from the opportunity related tab
