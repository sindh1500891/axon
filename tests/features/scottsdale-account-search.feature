@smoke @salesforce @scottsdale
Feature: Scottsdale account search with encrypted login
  As a test automation engineer
  I want to login using encrypted MCP credentials
  So that I can search and open an account in test sandbox

  Scenario: Login with encrypted credentials and open Scottsdale Gun Club account
    Given I am on the Salesforce test sandbox login page
    When I encrypt the username and password from env
    And I decrypt the credentials and enter username on the login page
    And I click the Log In to Sandbox button
    And I enter username if visible otherwise focus the password field
    And I decrypt and enter the password on the login page
    And I click the Log In to Sandbox button
    And I complete verification code if prompted
    And I wait for 10 seconds
    When I type "191028" in global search and open "Scottsdale Gun Club" from results
    And I wait for 5 seconds
    And I click the Related tab
    And I wait for 5 seconds
    And I click the New button
    And I click the Next button
    And I select today as the Close Date
    And I select "Pre Sales" as the Stage
    And I select "Existing Customer" as the Type
    And I type "Walter Abrams" in Primary Contact and select from results
    And I click the Cooperative Contract field
    And I enter "None" in the Cooperative Contract field
    And I wait for 5 seconds
    And I select "None" from the Cooperative Contract search results
    And I wait for 5 seconds
    And I append today's date and time to the Opportunity Name
    And I click the Save button
    And I wait for 15 seconds
    And I click the highlighted actions dropdown
    And I click New Quote
    And I click Save on the New Quote form
    And I click Show All in Related List Quick Links
    And I wait for 15 seconds
    And I click Quotes in Related List Quick Links
    And I wait for 10 seconds
    And I extract QuoteNumber from the quote link and click it
    And I wait for 10 seconds
    And I click the Edit Lines button
    And I wait for 5 seconds
    And I click the Add Products button
    And I click Search Products and type "C00018"
    And I select product "C00018" checkbox and click Select
    And I wait for 10 seconds
    And I enter Quantity as 1 on Configure Products
    And I click Save on Configure Products
    And I wait for 10 seconds
    And I click Save on Configure Products
    And I wait for 10 seconds
    And I wait for 5 seconds
    And I double click the highlighted div and enter "30%"
    And I click the Calculate button 4 times
    And I click the Expedite Reason dropdown and select "Bypass"
    And I wait for 5 seconds
    And I click the Discount Reason text area and enter "discount"
    And I wait for 5 seconds
    And I click Save on Quote Line Editor
    And I wait for 5 seconds
    And I click Continue on the Alert dialog
    And I wait for 5 seconds
    And I click the Invoice Plans tab
    And I wait for 5 seconds
    And I click the Create Invoice Plan button
    And I wait for 5 seconds
    And I click Create on the Create New Invoice Plan form
    And I wait for 5 seconds
    And I click the Shipping Details tab
    And I wait for 5 seconds
    And I click the Save All Shipping Details button
    And I wait for 5 seconds
    And I click the quote actions down arrow
    And I wait for 5 seconds
    And I highlight the Vertex Quote Tax Call button
    And I wait for 10 seconds
    And I click the close icon on the tax call dialog
    And I wait for 5 seconds
    And I click the Run Quote Quality Check button
    And I wait for 10 seconds
    And I wait for 5 seconds
    And I click the close icon on the quality check dialog
    And I click the Quote Quality Check tab
    And I wait for 10 seconds
    And I click the Refresh Results button
    And I wait for 10 seconds
    And I click the quote actions down arrow
    And I click the Submit for Approval button
    And I wait for 10 seconds
    And I click the Return to Quote button
    And I wait for 20 seconds
    And I scroll to the Status field
    And I wait for 10 seconds
    And I highlight the Status edit icon
    And I click the Status edit icon
    And I wait for 10 seconds
    And I click the Status picklist down arrow
    And I click the Status picklist and select "Approved"
    And I wait for 10 seconds
    And I click the Approval Status picklist and select "Approved"
    And I wait for 5 seconds
    And I click Save on the quote details form
    And I wait for 20 seconds
    And I click the quote actions down arrow
    And I click Generate Payment Soup
    And I wait for 20 seconds
    And I click the close icon on the Generate Payment Soup dialog
    And I wait for 10 seconds
    And I wait for 10 seconds
    And I click the Opportunity record link
    And I wait for 15 seconds
    And I click the Closed stage
    And I wait for 10 seconds
    And I click Select Closed Stage
    And I wait for 10 seconds
    And I click the Done button
    And I wait for 20 seconds
    And I validate the Stage field is "Closed Won"
    And I wait for 10 seconds
    And I click Show All in Related List Quick Links
    And I wait for 10 seconds
    And I scroll to Orders in Related List Quick Links
    And I click Orders
    And I wait for 20 seconds
    And I click the Order Number link
    And I click the Activate Order button
    And I wait for 10 seconds
    And I click the Start Order Activation button
    And I wait for 10 seconds
    And I click the close icon on the order activation dialog
    And I wait for 5 seconds
    And I click the highlighted refresh icon in Order Activation Status
    And I wait for 5 seconds
    And I refresh the page
    And I wait for 10 seconds