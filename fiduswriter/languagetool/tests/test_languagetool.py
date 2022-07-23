import time

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.wait import WebDriverWait
from selenium.common.exceptions import StaleElementReferenceException
from testing.testcases import LiveTornadoTestCase
from testing.selenium_helper import SeleniumHelper


class LanguagetoolTest(LiveTornadoTestCase, SeleniumHelper):
    fixtures = ["initial_documenttemplates.json", "initial_styles.json"]

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.base_url = cls.live_server_url
        driver_data = cls.get_drivers(1)
        cls.driver = driver_data["drivers"][0]
        cls.client = driver_data["clients"][0]
        cls.driver.implicitly_wait(driver_data["wait_time"])
        cls.wait_time = driver_data["wait_time"]

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()
        super().tearDownClass()

    def setUp(self):
        self.user = self.create_user(
            username="Yeti", email="yeti@snowman.com", passtext="otter1"
        )

    def tearDown(self):
        self.leave_site(self.driver)

    def assertInfoAlert(self, message):
        i = 0
        message_found = False
        while i < 100:
            i = i + 1
            info_alerts = self.driver.find_elements(
                By.CSS_SELECTOR, "body #alerts-outer-wrapper .alerts-info"
            )
            for alert in info_alerts:
                try:
                    if alert.text == message:
                        message_found = True
                        break
                except StaleElementReferenceException:
                    pass
            if not message_found:
                time.sleep(0.1)
                continue
        self.assertTrue(message_found)

    def test_spellcheck(self):
        self.login_user(self.user, self.driver, self.client)
        self.driver.get(self.base_url + "/")
        # Create chapter one doc
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".article-body").click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-body").send_keys(
            (
                "Thhis is me writing a sentence "
                "I forgetz the the periodz to much"
            )
        )
        self.driver.find_element(
            By.XPATH, '//*[@id="header-navigation"]/div[4]/span'
        ).click()
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Spell/grammar checker"]'
        ).click()
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Check text"]'
        ).click()
        self.assertInfoAlert("Spell/grammar check initialized.")
        self.assertInfoAlert("Spell/grammar check finished.")
        action = ActionChains(self.driver)
        action.move_to_element(
            self.driver.find_element(By.CSS_SELECTOR, "span.spelling")
        ).context_click().perform()
        self.driver.find_element(By.CSS_SELECTOR, "button.replacement").click()
        action = ActionChains(self.driver)
        action.move_to_element(
            self.driver.find_element(By.CSS_SELECTOR, "span.grammar")
        ).context_click().perform()
        self.driver.find_element(By.CSS_SELECTOR, "button.replacement").click()
        action = ActionChains(self.driver)
        action.move_to_element(
            self.driver.find_element(By.CSS_SELECTOR, "span.language")
        ).context_click().perform()
        self.driver.find_element(By.CSS_SELECTOR, "button.replacement").click()
        self.driver.find_element(
            By.XPATH, '//*[@id="header-navigation"]/div[4]/span'
        ).click()
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Spell/grammar checker"]'
        ).click()
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Remove marks"]'
        ).click()
        time.sleep(1)
        self.assertEqual(
            len(
                self.driver.find_elements(
                    By.CSS_SELECTOR, "span.language,span.spelling"
                )
            ),
            0,
        )
