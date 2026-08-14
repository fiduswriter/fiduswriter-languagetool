import json
import multiprocessing
import socket
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

from django.test.utils import override_settings

from testing.live_server import ChannelsLiveServerTestCase
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.wait import WebDriverWait
from selenium.common.exceptions import StaleElementReferenceException
from testing.selenium_helper import SeleniumHelper

# A small mock of the LanguageTool HTTP API (https://languagetool.org).
# This lets the Selenium test run without a real LanguageTool server.
# The matches below mirror what LanguageTool returns for the sentence
# typed in test_spellcheck.
LANGUAGES = [
    {"name": "Arabic", "code": "ar", "longCode": "ar"},
    {"name": "Asturian", "code": "ast", "longCode": "ast-ES"},
    {"name": "Belarusian", "code": "be", "longCode": "be-BY"},
    {"name": "Breton", "code": "br", "longCode": "br-FR"},
    {"name": "Catalan", "code": "ca", "longCode": "ca-ES"},
    {"name": "English (US)", "code": "en-US", "longCode": "en-US"},
    {"name": "German (Germany)", "code": "de-DE", "longCode": "de-DE"},
]

MATCHES = [
    {
        "message": "Possible spelling mistake found.",
        "shortMessage": "Spelling mistake",
        "replacements": [
            {"value": "This"},
            {"value": "Thais"},
            {"value": "Th\u00eds"},
            {"value": "Th his"},
        ],
        "offset": 0,
        "length": 5,
        "rule": {
            "id": "MORFOLOGIK_RULE_EN_US",
            "category": {"id": "TYPOS"},
        },
    },
    {
        "message": (
            "A verb may be missing between \u201cI\u201d and \u201cmy\u201d, "
            "or a word may be misspelled."
        ),
        "shortMessage": "",
        "replacements": [],
        "offset": 31,
        "length": 4,
        "rule": {
            "id": "PRP_THE",
            "category": {"id": "GRAMMAR"},
        },
    },
    {
        "message": "Possible spelling mistake found.",
        "shortMessage": "Spelling mistake",
        "replacements": [
            {"value": "forget"},
            {"value": "forgets"},
        ],
        "offset": 36,
        "length": 7,
        "rule": {
            "id": "MORFOLOGIK_RULE_EN_US",
            "category": {"id": "TYPOS"},
        },
    },
    {
        "message": "Possible typo: you repeated a word.",
        "shortMessage": "",
        "replacements": [{"value": "the"}],
        "offset": 44,
        "length": 7,
        "rule": {
            "id": "ENGLISH_WORD_REPEAT_RULE",
            "category": {"id": "MISC"},
        },
    },
    {
        "message": "Possible spelling mistake found.",
        "shortMessage": "Spelling mistake",
        "replacements": [
            {"value": "period"},
            {"value": "periods"},
        ],
        "offset": 52,
        "length": 7,
        "rule": {
            "id": "MORFOLOGIK_RULE_EN_US",
            "category": {"id": "TYPOS"},
        },
    },
]


class MockServerRequestHandler(BaseHTTPRequestHandler):
    def _send_json(self, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.endswith("/v2/languages"):
            self._send_json(LANGUAGES)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path.endswith("/v2/check"):
            self._send_json({"matches": MATCHES})
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


def get_free_port():
    s = socket.socket(socket.AF_INET, type=socket.SOCK_STREAM)
    s.bind(("localhost", 0))
    address, port = s.getsockname()
    s.close()
    return port


class LanguagetoolTest(ChannelsLiveServerTestCase, SeleniumHelper):
    fixtures = ["initial_documenttemplates.json", "initial_styles.json"]

    @classmethod
    def start_server(cls, port):
        httpd = HTTPServer(("", port), MockServerRequestHandler)
        httpd.serve_forever()

    @classmethod
    def setUpClass(cls):
        cls.server_port = get_free_port()
        cls.server = multiprocessing.Process(
            target=cls.start_server, args=(cls.server_port,)
        )
        cls.server.daemon = True
        cls.server.start()
        # Point the language checker at the mock server. The override must be
        # active before the live server child process is forked, because the
        # view reads settings.LT_URL at request time inside that process.
        cls._lt_override = override_settings(
            LT_URL="http://localhost:{}/".format(cls.server_port)
        )
        cls._lt_override.enable()

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
        cls.server.terminate()
        super().tearDownClass()
        cls._lt_override.disable()

    def setUp(self):
        self.user = self.create_user(
            username="Yeti", email="yeti@snowman.com", passtext="otter1"
        )

    def tearDown(self):
        self.leave_site(self.driver)

    def assertInfoProgress(self, message):
        i = 0
        message_found = False
        while i < 100:
            i = i + 1
            progress_items = self.driver.find_elements(
                By.CSS_SELECTOR,
                "body #fw-progress-outer-wrapper .fw-progress-info",
            )
            for item in progress_items:
                try:
                    if message in item.text:
                        message_found = True
                        break
                except StaleElementReferenceException:
                    pass
            if message_found:
                break
            time.sleep(0.1)
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
        self.driver.find_element(By.CSS_SELECTOR, ".doc-body").click()
        self.driver.find_element(By.CSS_SELECTOR, ".doc-body").send_keys(
            (
                "Thhis is me writing a sentence "
                "I my forgetz the the periodz to much"
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
        self.assertInfoProgress("Spell/grammar check initialized.")
        self.assertInfoProgress("Spell/grammar check finished.")
        action = ActionChains(self.driver)
        action.move_to_element(
            self.driver.find_element(By.CSS_SELECTOR, "span.spelling")
        ).context_click().perform()
        self.driver.find_element(By.CSS_SELECTOR, "button.replacement").click()
        action = ActionChains(self.driver)
        action.move_to_element(
            self.driver.find_element(By.CSS_SELECTOR, "span.grammar")
        ).context_click().perform()
        # Entering grammar advice. There should be no accept button here. Only a close button.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button.fw-orange"))
        )
        # Make sure the replacement button is missing.
        replacement_buttons = self.driver.find_elements(
            By.CSS_SELECTOR, "button.replacement"
        )
        self.assertEqual(len(replacement_buttons), 0)
        # Click the close button.
        self.driver.find_element(By.CSS_SELECTOR, "button.fw-orange").click()
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
