@PprExtendedEndpoints @P1 @functional
Feature: PPR Extended Endpoints
    As a GBM client
    I want to use extended PPR functionality
    So that I can update my salary and get portfolio projections

    Background:
        Given I have a valid access token
        And I have PPR questionnaire configuration

    @P1 @Level3 @functional @salary-update
    Scenario: Update gross monthly income successfully
        Given Generate EP token for salary update workflow
        When I update the gross monthly income to <newSalary> with change date <changeDate>
        Then I should get a successful salary update response
        And the response should contain updated salary <newSalary>
        Examples:
            | newSalary | changeDate |
            | 35000     | 2025-11    |
            | 45000     | 2025-12    |

    @P1 @Level3 @functional @portfolio-projection
    Scenario: Get portfolio projection for different portfolio types
        Given Generate EP token for portfolio projection workflow
        When I request portfolio projection for <portfolioType> with investment time <years> years, first deposit <firstDeposit>, and monthly deposit <monthlyDeposit>
        Then I should get a valid portfolio projection response
        And the response should contain projection data for <years> years
        Examples:
            | portfolioType | years | firstDeposit | monthlyDeposit |
            | debt          | 5     | 1000         | 1000           |
            | balance       | 10    | 5000         | 2000           |
            | growth        | 5     | 1000         | 1000           |

    @P1 @Level3 @functional @crypto
    Scenario Outline: Retrieve crypto variation
        When I retrieve crypto variation for currency "<currency>" and time period "<time_period>"
        Then I should receive a successful response for crypto variation
        Examples:
            | currency | time_period |
            | MXN      | one_day     |
            | USD      | one_week    |

    @negative @error-handling
    Scenario: Handle invalid parameters
        When I attempt to retrieve crypto variation <scenario>
        Then I should receive an error response
        Examples:
            | scenario                                                    |
            | without time period                                         |
            | for currency "MXN" and invalid time period "invalid_period" |
