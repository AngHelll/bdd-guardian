using Reqnroll;

namespace Gbm.Service.Automation.Steps
{
    [Binding]
    public class CommonSteps
    {
        [Given(@"I have a valid access token")]
        public void GivenIHaveAValidAccessToken()
        {
            // Token setup
        }

        [Given(@"I have PPR questionnaire configuration")]
        public void GivenIHavePprQuestionnaireConfiguration()
        {
            // Configuration setup
        }
    }

    [Binding]
    public class SalaryUpdateSteps
    {
        [Given(@"Generate EP token for salary update workflow")]
        public void GivenGenerateEpTokenForSalaryUpdateWorkflow()
        {
            // Generate EP token
        }

        [When(@"I update the gross monthly income to (\d+) with change date (.+)")]
        public void WhenIUpdateTheGrossMonthlyIncome(int salary, string changeDate)
        {
            // Update salary
        }

        [Then(@"I should get a successful salary update response")]
        public void ThenIShouldGetSuccessfulSalaryUpdateResponse()
        {
            // Verify success
        }

        [Then(@"the response should contain updated salary (\d+)")]
        public void ThenResponseShouldContainUpdatedSalary(int expectedSalary)
        {
            // Verify salary value
        }
    }

    [Binding]
    public class PortfolioProjectionSteps
    {
        [Given(@"Generate EP token for portfolio projection workflow")]
        public void GivenGenerateEpTokenForPortfolioProjection()
        {
            // Generate EP token
        }

        [When(@"I request portfolio projection for (debt|balance|growth|settlement|preservation|appreciation|equities) with investment time (\d+) years, first deposit (\d+), and monthly deposit (\d+)")]
        public void WhenIRequestPortfolioProjection(string portfolioType, int years, int firstDeposit, int monthlyDeposit)
        {
            // Request projection
        }

        [Then(@"I should get a valid portfolio projection response")]
        public void ThenIShouldGetValidPortfolioProjectionResponse()
        {
            // Verify response
        }

        [Then(@"the response should contain projection data for (\d+) years")]
        public void ThenResponseShouldContainProjectionDataForYears(int years)
        {
            // Verify projection data
        }
    }

    [Binding]
    public class CryptoVariationSteps
    {
        [When(@"I retrieve crypto variation for currency ""([^""]+)"" and time period ""([^""]+)""")]
        public void WhenIRetrieveCryptoVariation(string currency, string timePeriod)
        {
            // Retrieve crypto variation
        }

        [Then(@"I should receive a successful response for crypto variation")]
        public void ThenIShouldReceiveSuccessfulResponseForCryptoVariation()
        {
            // Verify success
        }

        // This is the tricky pattern - matches free-form text after "crypto variation"
        [When(@"I attempt to retrieve crypto variation (.+)")]
        public void WhenIAttemptToRetrieveCryptoVariation(string scenario)
        {
            // Handle various scenarios
        }

        [Then(@"I should receive an error response")]
        public void ThenIShouldReceiveErrorResponse()
        {
            // Verify error
        }

        // More specific pattern - could cause ambiguity with the (.+) pattern
        [When(@"I attempt to retrieve crypto variation for currency ""([^""]+)"" and invalid time period ""([^""]+)""")]
        public void WhenIAttemptToRetrieveCryptoVariationWithInvalidTimePeriod(string currency, string invalidPeriod)
        {
            // Handle invalid time period
        }
    }
}
