package com.example.steps;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.When;
import io.cucumber.java.en.Then;

public class SearchStepDefinitions {

    @Given("I have {int} cucumbers")
    public void i_have_cukes(int count) {
    }

    @When("I search for {word}")
    public void i_search_for(String query) {
    }

    @Then("I should see {string} in results")
    public void i_should_see_in_results(String message) {
    }
}
